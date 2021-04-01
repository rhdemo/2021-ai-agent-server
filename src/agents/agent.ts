import WebSocket, { CloseEvent } from 'ws';
import {
  AttackMessagePayload,
  CellPosition,
  ConfigMessagePayload,
  IncomingMessageStruct,
  MessageType,
  OutgoingAttack,
  ShipsLayoutData,
  ShipType,
  AI,
  MatchPhase
} from '../types';
import log from '../log';
import AgentStateMachine, { AgentState } from './agent.state.machine';
import { generateInitialBoardState, getNextMove } from '../ml';
import { MIN_ATTACK_DELAY, AGENT_SEND_DELAY } from '../config';

const NORMAL_WS_CLOSE = 1000;
const MAX_CONNECT_ATTEMPTS = 12;
const RECONNECT_DELAY = 5000;

export type AgentInitialisationOptions = {
  uuid: string;
  wsUrl: string;
  username: string;
  gridSize: number;
  gameId: string;
  onRetired: () => void;
};
/**
 * The Agent class represents an AI player. It uses an AgentStateMachine to
 * govern its behaviour.
 */
export default class Agent {
  private connectAttempts = 0;
  private fsm: AgentStateMachine;
  private socket: WebSocket | undefined;
  private config:
    | IncomingMessageStruct<
        ConfigMessagePayload | (ConfigMessagePayload & AttackMessagePayload)
      >
    | undefined;

  constructor(private options: AgentInitialisationOptions) {
    const fsm = (this.fsm = new AgentStateMachine());

    // Configure logging for all state changes
    Object.values(AgentState).forEach((stateName) => {
      fsm.onEnter(stateName, () =>
        log.info(`Agent ${this.getAgentUUID()} entering state: ${stateName}`)
      );
    });

    // Bind state transition event handlers
    fsm.onEnter(AgentState.Connecting, () => this._callbackConnecting());
    fsm.onEnter(AgentState.Connected, () => this._callbackConnected());
    fsm.onEnter(AgentState.Disconnected, () => this._callbackDisconnected());
    fsm.onEnter(AgentState.WaitingForConfig, () =>
      this._callbackWaitForConfig()
    );
    fsm.onEnter(AgentState.Positioning, () => this._callbackPositioning());
    fsm.onEnter(AgentState.WaitingForTurn, () => this._callbackWaitForTurn());
    fsm.onEnter(AgentState.Attacking, () => this._callbackAttack());
    fsm.onEnter(AgentState.BonusAttack, () => this._callbackAttack());
    fsm.onEnter(AgentState.LostGame, () => this._callbackGameOver(false));
    fsm.onEnter(AgentState.WonGame, () => this._callbackGameOver(true));

    // Kick off the Agent lifecycle by entering a "connecting" state
    fsm.transitTo(AgentState.Connecting);
  }

  public getCurrentState() {
    return this.fsm.currentState;
  }

  /**
   * Once an agent has won/lost a game we need to retire it. This means
   * disconnecting from the game server and informing
   */
  public retire() {
    log.info(`Agent ${this.getAgentUUID()} is being retired`);

    if (
      this.socket &&
      this.socket.readyState in [WebSocket.OPEN, WebSocket.CONNECTING]
    ) {
      log.trace(
        `Agent ${this.getAgentUUID()} socket being closed as part of retirement`
      );
      this.socket.removeAllListeners('close');
      this.socket.close(NORMAL_WS_CLOSE);
    }

    this.options.onRetired();
  }

  public getAgentUUID() {
    return this.options.uuid;
  }

  public getAgentGameId() {
    return this.options.gameId;
  }

  /**
   * The Agent must send a "Connection" payload any time they connect to the
   * game server, even if it's a reconnection after being disconnected
   */
  private _callbackConnected() {
    // The state machine will fail to change state if fsm.transitTo is called
    // in a callback. Use process.nextTick to delay the state change until
    // after the StateMachine has finished executing the transition tasks
    process.nextTick(() => {
      this.connectAttempts = 0;
      log.info(`Agent ${this.getAgentUUID()} sending connection payload`);
      this.send(MessageType.Outgoing.Connection, {
        username: this.options.username,
        playerId: this.options.uuid,
        gameId: this.options.gameId
      });
      this.fsm.transitTo(AgentState.WaitingForConfig);
    });
  }

  /**
   * If the Agent is disconnected it'll wait a while and attempt to reconnect
   */
  private _callbackDisconnected() {
    setTimeout(
      () => this.fsm.transitTo(AgentState.Connecting),
      RECONNECT_DELAY
    );
  }

  /**
   * When the Agent wins/loses they "retire", i.e disconnect and trigger their
   * onRetire callback to trigger cleanup or other events
   * @param winner
   */
  private _callbackGameOver(winner: boolean) {
    log.info(
      `Agent ${this.getAgentUUID()} ${winner ? 'won' : 'lost'} their match (${
        this.config?.data.match.uuid
      })`
    );
    this.retire();
  }

  private _callbackAttack() {
    this.attack();
  }

  private _callbackPositioning() {
    this.send(MessageType.Outgoing.ShipPositions, this.getShipPositions());
  }

  private _callbackWaitForConfig() {
    log.info(`Agent ${this.getAgentUUID()} waiting for config`);
  }

  private _callbackWaitForTurn() {
    log.info(`Agent ${this.getAgentUUID()} waiting for their turn`);
  }

  /**
   * Connect to the game websocket server, and configure websocket events.
   */
  private _callbackConnecting() {
    const { uuid } = this.options;

    if (this.connectAttempts > MAX_CONNECT_ATTEMPTS) {
      log.warn(
        `Agent ${this.getAgentUUID()} failed to connect after ${MAX_CONNECT_ATTEMPTS} attempts. Retiring.`
      );
      this.retire();
    } else {
      this.connectAttempts += 1;
      log.info(
        `Agent ${uuid} connecting to ${this.options.wsUrl}. Attempt #${this.connectAttempts}`
      );
      this.socket = new WebSocket(this.options.wsUrl);
      this.socket.on('open', () => this.fsm.transitTo(AgentState.Connected));
      this.socket.on('error', (e) => this.onWsError(e));
      this.socket.on('close', (code) => this.onWsClose(code));
      this.socket.on('message', (message) => this.onWsMessage(message));
    }
  }

  /**
   * If the socket is closed with an unexpected error then the agent must
   * attempt to reconnect so the game can be finished.
   * @param code
   */
  private onWsClose(code: number) {
    if (code === NORMAL_WS_CLOSE) {
      log.info(`Agent ${this.getAgentUUID()} socket closed normally`);
      this.retire();
    } else {
      log.warn(
        `Agent ${this.getAgentUUID()} socket closed abnormally with code ${code}`
      );

      this.fsm.transitTo(AgentState.Disconnected);
    }
  }

  /**
   * If a WebSocket error occurs then trigger a "Disconnected" state transition
   * to reestablish a connection and reset the connection with the game server
   * @param e
   */
  private onWsError(e: Error | number) {
    log.error(`socket for player ${this.options.uuid} error:`);
    log.error(e.toString());
  }

  /**
   * Process data sent by the socket server to this Agent instance.
   * @param message
   */
  private onWsMessage(message: WebSocket.Data) {
    // TODO try/catch error handling on this, and other validation
    const parsedMessage = JSON.parse(
      message.toString()
    ) as IncomingMessageStruct<unknown>;

    if (parsedMessage.type === MessageType.Incoming.Configuration) {
      this.onConfigurationPayload(
        parsedMessage as IncomingMessageStruct<ConfigMessagePayload>
      );
    } else if (
      parsedMessage.type === MessageType.Incoming.AttackResult ||
      parsedMessage.type === MessageType.Incoming.BonusResult
    ) {
      this.onAttackResultPayload(
        parsedMessage as IncomingMessageStruct<
          ConfigMessagePayload & AttackMessagePayload
        >
      );
    } else if (parsedMessage.type === MessageType.Incoming.Heartbeat) {
      log.trace(`agent ${this.getAgentUUID()} received heartbeat`);
    } else if (parsedMessage.type === MessageType.Incoming.ScoreUpdate) {
      log.trace(
        `agent ${this.getAgentUUID()} received score update: %j`,
        message
      );
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
    const { winner, state } = message.data.match;
    if (winner && winner === this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.WonGame);
    } else if (winner && winner !== this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.LostGame);
    } else if (
      state.activePlayer === this.getAgentUUID() &&
      state.phase === MatchPhase.Attack
    ) {
      log.info(`Agent ${this.getAgentUUID()} is due to attack`);
      this.fsm.transitTo(AgentState.Attacking);
    } else if (
      state.activePlayer === this.getAgentUUID() &&
      state.phase === MatchPhase.Bonus
    ) {
      log.info(`Agent ${this.getAgentUUID()} is due to bonus attack`);
      this.fsm.transitTo(AgentState.BonusAttack);
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
    } else if (this.hasSetValidShipPositions()) {
      // Agent has successfully set positions, prepare to attack, or wait for turn
      if (this.isAppropriateToAttack()) {
        this.fsm.transitTo(AgentState.Attacking);
      } else {
        this.fsm.transitTo(AgentState.WaitingForTurn);
      }
    } else {
      log.trace(`Agent ${this.getAgentUUID()} must set positions.`);
      this.fsm.transitTo(AgentState.Positioning);
    }
  }

  /**
   * The agent should only attempt to attack if it's their turn AND the
   * overall game state is set to "active"
   */
  private isAppropriateToAttack() {
    const isTurn =
      this.config?.data.match.state.activePlayer === this.getAgentUUID();
    const isActive = this.config?.data.game.state === 'active';

    return isActive && isTurn;
  }

  /**
   * Determines if the agent has set positions, and if those positions were
   * considered valid by the game server.
   */
  private hasSetValidShipPositions() {
    return this.config?.data.player.board?.valid;
  }

  /**
   * Returns a ship positioning/layout that can be sent to the game server.
   * By default the Agent will accept the randomised positions that the game
   * server provides, but if those are missing it will use a preset layout
   */
  private getShipPositions(): ShipsLayoutData {
    // The server should send back a random ship layout. The agent can choose
    // to use this layout. If it's missing the agent will use a default
    const serverSentPositions = this.config?.data.player.board?.positions;

    if (!serverSentPositions) {
      log.warn(`Agent ${this.getAgentUUID()} is using default ship layout.`);
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
    } else {
      return serverSentPositions;
    }
  }

  /**
   * If the AI/Prediction service fails, then we need to fall back to a
   * primitive attack strategy. This strategy attacks from top-left toward
   * the bottom right of the opponent board.
   */
  private _attackFallback(
    config: IncomingMessageStruct<ConfigMessagePayload & AttackMessagePayload>
  ): CellPosition | undefined {
    log.warn(`Agent ${this.getAgentUUID()} is using attack fallback.`);

    const { gridSize } = this.options;
    const { attacks } = config.data.player;

    for (let x = 0; x <= gridSize - 1; x++) {
      for (let y = 0; y <= gridSize - 1; y++) {
        const existingAttack = attacks.find((atk) => {
          return atk.attack.origin[0] === x && atk.attack.origin[1] === y;
        });

        if (!existingAttack) {
          return [x, y];
        }
      }
    }
  }

  /**
   * Attacking requires the agent to make a HTTP request to the AI/prediction
   * service. The service will determine the best square to attack.
   *
   * To make a choice, the AI/prediction service requires us to send the known
   * board state of the opponent in a specific format. This state is purely
   * from the agent perspective, i.e it only knows:
   *  - its hits
   *  - its misses
   *  - and which opponent ships it has sunk
   */
  private async attack() {
    const { config } = this;

    if (!config) {
      log.error(
        `Agent ${this.getAgentUUID()} cannot determine attack. No config data exists`
      );

      return this.fsm.transitTo(AgentState.WaitingForConfig);
    }

    if (config.data.match.state.phase === MatchPhase.Bonus) {
      // It's a bonus round. AI agent doesn't do anything for this
      log.info(`Agent ${this.getAgentUUID()} sending default bonus payload`);
      this.send(MessageType.Outgoing.Bonus, { hits: 0 });
    } else {
      // Launch a regular attack
      const attackStartTs = Date.now();

      log.debug(`Agent ${this.getAgentUUID()} determining attack cell`);

      const boardState = generateInitialBoardState();
      const hitShips = Object.keys(config.data.opponent.board).map((ship) => {
        const { type, cells } = config.data.opponent.board[ship as ShipType];

        return {
          type,
          cells: cells.map((c) => c.origin)
        };
      });
      const attacks = config.data.player.attacks;

      attacks.forEach((atk) => {
        log.trace(
          `Agent ${this.getAgentUUID()} updating board state based on attack: %j`,
          atk
        );

        const x = atk.attack.origin[0];
        const y = atk.attack.origin[1];
        const isHit = atk.result.hit;

        boardState[x][y] = isHit ? AI.CellState.Hit : AI.CellState.Miss;
      });

      log.trace(
        `Agent ${this.getAgentUUID()} board state for AI service: %j`,
        boardState
      );
      log.trace(
        `Agent ${this.getAgentUUID()} hit ships for AI service: %j`,
        hitShips
      );
      log.debug(
        `Agent ${this.getAgentUUID()} requesting prediction from AI service`
      );

      const prediction = await getNextMove(boardState, hitShips);
      const fallback = this._attackFallback(
        config as IncomingMessageStruct<
          ConfigMessagePayload & AttackMessagePayload
        >
      );
      const origin: CellPosition | undefined = prediction
        ? [prediction.x, prediction.y]
        : fallback;

      if (!origin) {
        log.error(
          `Agent ${this.getAgentUUID()} was unable to get an attack prediction from AI service, nor did it determine a fallback. The Agent will be retired.`
        );
        this.retire();
      } else {
        const processingTime = Date.now() - attackStartTs;
        const delay = Math.max(0, MIN_ATTACK_DELAY - processingTime);
        const attackPayload: OutgoingAttack = {
          type: '1x1',
          origin,
          prediction
        };

        log.info(
          `Agent ${this.getAgentUUID()} attacking %j after ${delay}ms delay.`,
          attackPayload.origin
        );

        setTimeout(() => {
          this.send(MessageType.Outgoing.Attack, attackPayload);
        }, delay);
      }
    }
  }

  /**
   * Wrapper to ensure we don't attempt to send data on a closed socket.
   * @param type
   * @param data
   */
  private send(type: MessageType.Outgoing, data: unknown) {
    // The game server enforces a mutex on message processing. Sometimes the
    // agent is too fast and messages are rejected. Delay sending slightly.
    setTimeout(() => {
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
    }, AGENT_SEND_DELAY);
  }
}
