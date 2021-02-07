import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { AttackMessagePayload, CellPosition, ConfigMessagePayload, IncomingMessageStruct, MessageType } from '../types'
import log from '../log';
import AgentStateMachine, { AgentState } from './agent.state.machine';

export type AgentInitialisationOptions = {
  uuid: string
  wsUrl: string
  username: string
  gridSize: number
}

export default class Agent extends EventEmitter {
  private fsm: AgentStateMachine
  private socket: WebSocket | undefined
  private config: IncomingMessageStruct<ConfigMessagePayload|ConfigMessagePayload&AttackMessagePayload> | undefined

  constructor(private options: AgentInitialisationOptions) {
    super()

    log.info(`creating a new agent with uuid ${options.uuid} and username ${options.username}`)

    const fsm = this.fsm = new AgentStateMachine()

    // Configure logging for all state changes
    Object.values(AgentState).forEach(stateName => {
      fsm.onEnter(stateName, () => log.info(`Agent ${this.getAgentUUID()} entering state: ${stateName}`))
    })

    fsm.onEnter(AgentState.Connecting, (delay?: number) => this.connect(delay))

    fsm.onEnter(AgentState.Connected, () => {
      process.nextTick(() => {
        log.info(`Agent ${this.getAgentUUID()} sending connection payload`)
        this.send(MessageType.Outgoing.Connection, this.options)
        this.fsm.transitTo(AgentState.WaitingForConfig)
      })
    })

    fsm.onEnter(AgentState.WaitingForConfig, () => {
      log.info(`Agent ${options.uuid} waiting for config`)
    })

    fsm.onEnter(AgentState.Waiting, (arg) => {
      log.info(`Agent ${this.getAgentUUID()} entered waiting state: %j`, arg)
    })

    fsm.onEnter(AgentState.Positioning, () => {
      this.send(MessageType.Outgoing.ShipPositions, this.generateShipPositions())
    })

    fsm.onEnter(AgentState.WaitingForTurn, () => {
      log.info(`Agent ${options.uuid} waiting for their turn`)
    })

    fsm.onEnter(AgentState.Attacking, () => {
      process.nextTick(() => this.attack())
    })

    fsm.onEnter(AgentState.LostGame, () => {
      log.info(`Agent ${this.getAgentUUID()} lost their match (${this.config?.data.match.uuid})`)
      this.socket?.close()
    })

    fsm.onEnter(AgentState.WonGame, () => {
      log.info(`Agent ${this.getAgentUUID()} won their match (${this.config?.data.match.uuid})`)
      this.socket?.close()
    })

    // Kick off the Agent lifecycle by entering a "connecting" state
    fsm.transitTo('Connecting')
  }

  public getCurrentState () {
    return this.fsm.currentState
  }

  public retire () {
    log.info(`Agent ${this.getAgentUUID()} is being retired`)
    this.socket?.close()
  }

  public getAgentUUID() {
    return this.options.uuid
  }

  /**
   * Connect to the game websocket server, and configure websocket events.
   * An optional "delay" parameter can be passed to stagger reconnection
   * attempts if the game server happens to go down.
   */
  private connect(delay = 0) {
    const { uuid } = this.options

    if (this.socket) {
      log.debug(`closing old socket for player ${uuid}`)
      this.socket.close()
    }

    log.info(`Agent ${uuid} connecting to ${this.options.wsUrl}`)

    setTimeout(() => {
      this.socket = new WebSocket(this.options.wsUrl)
      this.socket.on('open', () => this.fsm.transitTo(AgentState.Connected))
      this.socket.on('error', (e) => this.onWsError(e))
      this.socket.on('message', (message) => this.onWsMessage(message))
    }, delay)
  }

  private onWsError(e: number | Error) {
    if (typeof e === 'number') {
      log.error(`socket for player ${this.options.uuid} closed with code: %s`, e)
    } else {
      log.error(`socket for player ${this.options.uuid} closed due to error:`)
      log.error(e)
    }

    this.fsm.transitTo(AgentState.Connecting, 1000)
  }

  private onWsMessage(message: WebSocket.Data) {
    // TODO try/catch error handling on this, and other validation
    const parsedMessage = JSON.parse(message.toString()) as IncomingMessageStruct<unknown>

    if (parsedMessage.type === MessageType.Incoming.Configuration) {
      this.onConfigurationPayload(parsedMessage as IncomingMessageStruct<ConfigMessagePayload>)
    } else if (parsedMessage.type === MessageType.Incoming.AttackResult) {
      this.onAttackResultPayload(parsedMessage as IncomingMessageStruct<ConfigMessagePayload & AttackMessagePayload>)
    } else {
      log.warn(`agent ${this.getAgentUUID()} received a message that could not be handled: %j`, parsedMessage)
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
  private onAttackResultPayload(message: IncomingMessageStruct<ConfigMessagePayload & AttackMessagePayload>) {
    const { winner, activePlayer } = message.data.match
    if (winner && winner === this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.WonGame)
    } else if (winner && winner !== this.getAgentUUID()) {
      this.fsm.transitTo(AgentState.LostGame)
    } else if (activePlayer === this.getAgentUUID()) {
      log.info(`Agent ${this.getAgentUUID()} is due to attack`)
      this.fsm.transitTo(AgentState.Attacking)
    } else {
      this.fsm.transitTo(AgentState.WaitingForTurn)
    }
  }

  private onConfigurationPayload(message: IncomingMessageStruct<ConfigMessagePayload>) {
    // Store the new config
    this.config = message

    const { state } = this.config.data.game

    log.trace(`Agent ${this.getAgentUUID()} stored new config: %j`, message)

    if (state === 'paused' || state === 'stopped') {
      this.fsm.transitTo(AgentState.Waiting, state)
    } else if (this.hasSetShipPositions()) {
      // Agent has successfully set positions, prepare to attack, or wait for turn
      if (this.isAgentTurn()) {
        this.fsm.transitTo(AgentState.Attacking)
      } else {
        this.fsm.transitTo(AgentState.WaitingForTurn)
      }
    } else {
      log.trace(`Agent ${this.getAgentUUID()} must set positions.`)
      this.fsm.transitTo(AgentState.Positioning)
    }
  }

  private isAgentTurn () {
    const isTurn = this.config?.data.match.activePlayer === this.getAgentUUID()
    const isActive = this.config?.data.game.state === 'active'

    return isActive && isTurn
  }

  private hasSetShipPositions () {
    return this.config?.data.player.board?.valid
  }

  private generateShipPositions() {
    // TODO: randomise or call out to AI service to choose
    return {
      "Submarine": {
        "origin": [
          0,
          0
        ],
        "orientation": "horizontal"
      },
      "Destroyer": {
        "origin": [
          2,
          1
        ],
        "orientation": "horizontal"
      },
      "Battleship": {
        "origin": [
          0,
          1
        ],
        "orientation": "vertical"
      }
    }
  }

  private attack () {
    log.debug(`determining attack cell for ${this.getAgentUUID()}`)

    const { gridSize } = this.options
    const attacks = this.config?.data.player.attacks || []
    let attackOrigin: CellPosition|undefined = undefined

    for (let x = 0; x <= gridSize-1; x++) {
      if (attackOrigin) { break }

      for (let y = 0; y <= gridSize-1; y++) {
        const existingAttack = attacks.find(atk => (atk.attack.origin[0] === x && atk.attack.origin[1] === y))

        if (!existingAttack) {
          attackOrigin = [x, y]
          log.trace('set attack origin to: %j', attackOrigin)
          break
        }
      }
    }

    if (!attackOrigin) {
      log.warn(`Agent ${this.getAgentUUID()} was unable to attack. failed to find a free cell`)
    } else {
      log.info(`Agent ${this.getAgentUUID()} attacking cell: %j`, attackOrigin)
      this.send(MessageType.Outgoing.Attack, {
        type: '1x1',
        origin: [1, 0],
        orientation: 'horizontal'
      })
    }

  }

  private send(type: MessageType.Outgoing, data: unknown) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      log.trace(`Agent ${this.getAgentUUID()} sending "${type}" with payload: %j`, data)
      this.socket.send(JSON.stringify({
        type,
        data
      }))
    } else {
      log.warn(`player agent ${this.getAgentUUID()} attempted to send "${type}" data when socket was not open: %j`, data)
    }
  }
}
