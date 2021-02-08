import "reflect-metadata"
import { StateMachine, IStateDeclaration } from '@evanshortiss/tstate-machine'

export enum AgentState {
  Connecting = 'Connecting',
  Connected = 'Connected',
  Disconnected = 'Disconnected',
  WaitingForConfig = 'WaitingForConfig',
  Positioning = 'Positioning',
  WaitingForTurn = 'WaitingForTurn',
  Attacking = 'Attacking',
  WonGame = 'WonGame',
  LostGame = 'LostGame'
}

type AgentStateData = IStateDeclaration<AgentStateMachine>;

export default class AgentStateMachine extends StateMachine {

  /**
   * Connecting state can transition to:
   *  * "Connected" if the socket connects successfully.
   *  * "Disconnected" if connection fails and a reconnect attempt should be made.
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Connected, AgentState.Disconnected])
  [AgentState.Connecting]: AgentStateData = {}

  /**
   * Waiting state always transitions to "Connecting" since it's exclusively
   * used to stagger reconnect attempts (for now)
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Connecting])
  [AgentState.Disconnected]: AgentStateData = {}

  /**
   * Connected state can transition to:
   *  * "Disconnected" if the connection drops
   *  * "WaitingForConfig" while it awaits an initial server config
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Disconnected, AgentState.WaitingForConfig])
  [AgentState.Connected]: AgentStateData = {}

  /**
   * WaitingForConfig state can transition to:
   *  * "Disconnected" if the connection drops, or the game is "paused"/"stopped"
   *  * "Positioning" if the Agent has not yet set their ship positions
   *  * "WaitingForTurn"/"Attacking" if positions are set and game is "active"
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Disconnected, AgentState.Positioning, AgentState.WaitingForTurn, AgentState.Attacking])
  [AgentState.WaitingForConfig]: AgentStateData = {}

  /**
   * Positioning state can transition to:
   *  * "Disconnected" if the connection drops, or the game is "paused"/"stopped"
   *  * "WaitingForTurn"/"Attacking" when positions are accepted and game is "active"
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Disconnected, AgentState.WaitingForTurn, AgentState.Attacking])
  [AgentState.Positioning]: AgentStateData = {}

  /**
   * Positioning state can transition to:
   *  * "Disconnected" if the connection drops, or the game is "paused"/"stopped"
   *  * "Attacking" when the Agent turn arrives
   *  * "WaitingForConfig" when the the admins pause the game
   *  * "LostGame" if the opponent has sunk all the Agent ships
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Disconnected, AgentState.Attacking,  AgentState.WaitingForConfig, AgentState.LostGame])
  [AgentState.WaitingForTurn]: AgentStateData = {}

  /**
   * Attacking state can transition to:
   *  * "Disconnected" if the connection drops, or the game is "paused"/"stopped"
   *  * "WaitingForTurn" when the Agent has attacked and turns change
   *  * "WaitingForConfig" when the the admins pause the game
   *  * "WonGame" if the Agent has sunk all the opponent ships
   */
  @StateMachine.extend(StateMachine.INITIAL, [AgentState.Disconnected, AgentState.WaitingForTurn, AgentState.WaitingForConfig, AgentState.WonGame])
  [AgentState.Attacking]: AgentStateData = {}

  /**
   * Win/Lost states do not transition to another state.
   */
  @StateMachine.extend(StateMachine.INITIAL)
  [AgentState.LostGame]: AgentStateData = {}
  @StateMachine.extend(StateMachine.INITIAL)
  [AgentState.WonGame]: AgentStateData = {}

  @StateMachine.hide
  protected get $next(): Array<string> {
    // This is a required override to allow the state machine
    // to transition from State.INITIAL to Connecting
    return [AgentState.Connecting];
  }

  constructor() {
    super()
  }
}
