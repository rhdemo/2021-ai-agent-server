import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  AttackMessagePayload,
  CellPosition,
  ConfigMessagePayload,
  IncomingMessageStruct,
  MessageType,
  ShipType
} from '../types';
import log from '../log';
import AgentStateMachine, { AgentState } from './agent.state.machine';
import { CellState, generateInitialBoardState, getNextMove } from '../ml';
import { MIN_ATTACK_DELAY } from '../config';

export type AgentInitialisationOptions = {
  uuid: string;
  wsUrl: string;
  username: string;
  gridSize: number;
  gameId: string;
};

export default class Agent extends EventEmitter {
  private fsm: AgentStateMachine;
  private socket: WebSocket | undefined;
  private config:
    | IncomingMessageStruct<
        ConfigMessagePayload | (ConfigMessagePayload & AttackMessagePayload)
      >
    | undefined;

  constructor(private options: AgentInitialisationOptions) {
    super();

    log.info(
      `creating a new agent with uuid ${options.uuid} and username ${options.username}`
    );

    const fsm = (this.fsm = new AgentStateMachine());

    // Configure logging for all state changes
    Object.values(AgentState).forEach((stateName) => {
      fsm.onEnter(stateName, () =>
        log.info(`Agent ${this.getAgentUUID()} entering state: ${stateName}`)
      );
    });

    fsm.onEnter(AgentState.Connecting, () => this.connect());

    fsm.onEnter(AgentState.Connected, () => {
      process.nextTick(() => {
        log.info(`Agent ${this.getAgentUUID()} sending connection payload`);
        this.send(MessageType.Outgoing.Connection, {
          username: options.username,
          playerId: options.uuid,
          gameId: options.gameId
        });
        this.fsm.transitTo(AgentState.WaitingForConfig);
      });
    });

    fsm.onEnter(AgentState.WaitingForConfig, () => {
      log.info(`Agent ${options.uuid} waiting for config`);
    });

    fsm.onEnter(AgentState.Positioning, () => {
      this.send(
        MessageType.Outgoing.ShipPositions,
        this.generateShipPositions()
      );
    });

    fsm.onEnter(AgentState.WaitingForTurn, () => {
      log.info(`Agent ${options.uuid} waiting for their turn`);
    });

    fsm.onEnter(AgentState.Attacking, () => {
      process.nextTick(() => this.attack());
    });

    fsm.onEnter(AgentState.LostGame, () => {
      log.info(
        `Agent ${this.getAgentUUID()} lost their match (${
          this.config?.data.match.uuid
        })`
      );
      this.socket?.close();
    });

    fsm.onEnter(AgentState.WonGame, () => {
      log.info(
        `Agent ${this.getAgentUUID()} won their match (${
          this.config?.data.match.uuid
        })`
      );
      this.socket?.close();
    });

    // Kick off the Agent lifecycle by entering a "connecting" state
    fsm.transitTo('Connecting');
  }

  public getCurrentState() {
    return this.fsm.currentState;
  }

  public retire() {
    log.info(`Agent ${this.getAgentUUID()} is being retired`);
    this.socket?.close();
  }

  public getAgentUUID() {
    return this.options.uuid;
  }

  /**
   * Connect to the game websocket server, and configure websocket events.
   * An optional "delay" parameter can be passed to stagger reconnection
   * attempts if the game server happens to go down.
   */
  private connect(delay = 0) {
    const { uuid } = this.options;

    if (this.socket) {
      log.debug(`closing old socket for player ${uuid}`);
      this.socket.close();
    }

    log.info(`Agent ${uuid} connecting to ${this.options.wsUrl}`);

    setTimeout(() => {
      this.socket = new WebSocket(this.options.wsUrl);
      this.socket.on('open', () => this.fsm.transitTo(AgentState.Connected));
      this.socket.on('error', (e) => this.onWsError(e));
      this.socket.on('close', (e) => console.log('WSS CLOSED', e));
      this.socket.on('message', (message) => this.onWsMessage(message));
    }, delay);
  }

  private onWsError(e: number | Error) {
    if (typeof e === 'number') {
      log.error(
        `socket for player ${this.options.uuid} closed with code: %s`,
        e
      );
    } else {
      log.error(`socket for player ${this.options.uuid} closed due to error:`);
      log.error(e);
    }

    this.fsm.transitTo(AgentState.Disconnected);
    setTimeout(() => this.fsm.transitTo(AgentState.Connecting), 1000);
  }

  private onWsMessage(message: WebSocket.Data) {
    // TODO try/catch error handling on this, and other validation
    const parsedMessage = JSON.parse(
      message.toString()
    ) as IncomingMessageStruct<unknown>;

    if (parsedMessage.type === MessageType.Incoming.Configuration) {
      this.onConfigurationPayload(
        parsedMessage as IncomingMessageStruct<ConfigMessagePayload>
      );
    } else if (parsedMessage.type === MessageType.Incoming.AttackResult) {
      this.onAttackResultPayload(
        parsedMessage as IncomingMessageStruct<
          ConfigMessagePayload & AttackMessagePayload
        >
      );
    } else if (parsedMessage.type === MessageType.Incoming.Heartbeat) {
      log.trace(`received heartbeat for agent ${this.getAgentUUID()}`);
    } else {
      log.warn(
        `agent ${this.getAgentUUID()} received a message that could not be handled: %j`,
        parsedMessage
      );
    }
  }

  /**
   * When an attack result is received the player can:
   *  1. Be declared a winner
   *  2. Be declared a loser
   *  3. Be told it's their turn
   *  3. Be told it's the opponent's turn
   * @param message
   */
  private onAttackResultPayload(
    message: IncomingMessageStruct<ConfigMessagePayload & AttackMessagePayload>
  ) {
    // Store the new config
    this.config = message;

    log.trace(
      `agent ${this.getAgentUUID()} received attack response: %j`,
      message
    );
    const { winner, activePlayer } = message.data.match;
    if (winner && winner === this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.WonGame);
    } else if (winner && winner !== this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.LostGame);
    } else if (activePlayer === this.getAgentUUID()) {
      log.info(`Agent ${this.getAgentUUID()} is due to attack`);
      this.fsm.transitTo(AgentState.Attacking);
    } else {
      this.fsm.transitTo(AgentState.WaitingForTurn);
    }
  }

  private onConfigurationPayload(
    message: IncomingMessageStruct<ConfigMessagePayload>
  ) {
    // Store the new config
    this.config = message;

    const { state } = this.config.data.game;

    log.trace(`Agent ${this.getAgentUUID()} stored new config: %j`, message);

    if (state === 'paused' || state === 'stopped') {
      this.fsm.transitTo(AgentState.WaitingForConfig, state);
    } else if (this.hasSetShipPositions()) {
      // Agent has successfully set positions, prepare to attack, or wait for turn
      if (this.isAgentTurn()) {
        this.fsm.transitTo(AgentState.Attacking);
      } else {
        this.fsm.transitTo(AgentState.WaitingForTurn);
      }
    } else {
      log.trace(`Agent ${this.getAgentUUID()} must set positions.`);
      this.fsm.transitTo(AgentState.Positioning);
    }
  }

  private isAgentTurn() {
    const isTurn = this.config?.data.match.activePlayer === this.getAgentUUID();
    const isActive = this.config?.data.game.state === 'active';

    return isActive && isTurn;
  }

  private hasSetShipPositions() {
    return this.config?.data.player.board?.valid;
  }

  private generateShipPositions() {
    // TODO: randomise or call out to AI service to choose
    return {
      [ShipType.Carrier]: {
        origin: [4, 0],
        orientation: 'vertical'
      },
      [ShipType.Submarine]: {
        origin: [0, 0],
        orientation: 'horizontal'
      },
      [ShipType.Destroyer]: {
        origin: [1, 1],
        orientation: 'horizontal'
      },
      [ShipType.Battleship]: {
        origin: [0, 1],
        orientation: 'vertical'
      }
    };
  }

  private _attackFallback() {
    log.warn(`Agent ${this.getAgentUUID()} is attempting attack fallback`);
    const { gridSize } = this.options;
    const attacks = this.config?.data.player.attacks || [];
    let attackOrigin: CellPosition | undefined = undefined;

    for (let x = 0; x <= gridSize - 1; x++) {
      if (attackOrigin) {
        break;
      }

      for (let y = 0; y <= gridSize - 1; y++) {
        const existingAttack = attacks.find((atk) => {
          return atk.attack.origin[0] === x && atk.attack.origin[1] === y;
        });

        if (!existingAttack) {
          attackOrigin = [x, y];
          log.trace('set attack origin to: %j', attackOrigin);
          break;
        }
      }
    }

    return attackOrigin;
  }

  private async attack() {
    if (!this.config) {
      throw new Error(
        `Agent ${this.getAgentUUID()} cannot determine attack. No config data exists`
      );
    }

    const attackStartTs = Date.now();

    log.debug(`Agent ${this.getAgentUUID()} determining attack cell`);

    const boardState = generateInitialBoardState();
    const hitShips = Object.keys(this.config.data.opponent.board) as ShipType[];
    const attacks = this.config.data.player.attacks;

    for (let i = 0; i < attacks.length; i++) {
      const atk = attacks[i];

      log.trace(
        `Agent ${this.getAgentUUID()} updating board state based on attack: %j`,
        atk
      );

      const x = atk.attack.origin[0];
      const y = atk.attack.origin[1];
      const isHit = atk.results.reduce((ret, val) => ret && val.hit, true);

      boardState[x][y] = isHit ? CellState.Hit : CellState.Miss;
    }

    log.trace(
      `Agent ${this.getAgentUUID()} board state for AI service: %j`,
      boardState
    );
    log.trace(
      `Agent ${this.getAgentUUID()} hit ships for AI service: %j`,
      hitShips
    );

    let attackOrigin: CellPosition | undefined;
    try {
      log.debug(
        `Agent ${this.getAgentUUID()} requesting prediction from AI service`
      );
      const prediction = await getNextMove(boardState, hitShips);
      attackOrigin = [prediction.x, prediction.y];
    } catch (e) {
      log.error(
        `Agent ${this.getAgentUUID()} was unable to get an attack prediction from AI service`
      );
      attackOrigin = this._attackFallback();
    } finally {
      if (!attackOrigin) {
        log.warn(
          `Agent ${this.getAgentUUID()} was unable to determine a valid attack.`
        );
      } else {
        log.info(
          `Agent ${this.getAgentUUID()} attacking cell: %j`,
          attackOrigin
        );

        // The processing time for the prediction service can vary, but we
        // need to make it seem as though the agent is "thinking" before it
        // plays its turn. Enforcing a minimum delay will reduce player
        // frustration. Similarly, read this for a laugh:
        // https://twitter.com/sharifshameem/status/1344246374737399808
        const processingTime = Date.now() - attackStartTs;
        const delay = Math.min(0, MIN_ATTACK_DELAY - processingTime);

        setTimeout(() => {
          this.send(MessageType.Outgoing.Attack, {
            type: '1x1',
            origin: attackOrigin,
            orientation: 'horizontal'
          });
        }, delay);
      }
    }
  }

  private send(type: MessageType.Outgoing, data: unknown) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      log.trace(
        `Agent ${this.getAgentUUID()} sending "${type}" with payload: %j`,
        data
      );
      this.socket.send(
        JSON.stringify({
          type,
          data
        })
      );
    } else {
      log.warn(
        `player agent ${this.getAgentUUID()} attempted to send "${type}" data when socket was not open: %j`,
        data
      );
    }
  }
}
