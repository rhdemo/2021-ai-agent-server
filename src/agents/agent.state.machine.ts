import "reflect-metadata"
import { StateMachine, IStateDeclaration } from '@evanshortiss/tstate-machine'

export enum AgentState {
  Connecting = 'Connecting',
  Connected = 'Connected',
  Waiting = 'Waiting',
  WaitingForConfig = 'WaitingForConfig',
  Positioning = 'Positioning',
  WaitingForTurn = 'WaitingForTurn',
  Attacking = 'Attacking',
  WonGame = 'WonGame',
  LostGame = 'LostGame'
}

type AgentStateData = IStateDeclaration<AgentStateMachine>;

export default class AgentStateMachine extends StateMachine {
  text: string = StateMachine.INITIAL

  @StateMachine.extend(StateMachine.INITIAL, Object.values(AgentState))
  [AgentState.Waiting]: AgentStateData = {
    text: AgentState.Waiting
  }

  @StateMachine.extend(StateMachine.INITIAL, [AgentState.WaitingForConfig, AgentState.Connected])
  [AgentState.Connecting]: AgentStateData = {
    text: AgentState.Connected
  }

  @StateMachine.extend(AgentState.Connecting, [AgentState.Connected, AgentState.WaitingForConfig])
  [AgentState.Connected]: AgentStateData = {
    text: AgentState.Connected
  }

  @StateMachine.extend(AgentState.Connected, [AgentState.Connecting, AgentState.Positioning, AgentState.WaitingForTurn, AgentState.Attacking, AgentState.Waiting])
  [AgentState.WaitingForConfig]: AgentStateData = {
    text: AgentState.WaitingForConfig
  }

  @StateMachine.extend(AgentState.WaitingForConfig, [AgentState.Connecting, AgentState.WaitingForTurn, AgentState.Attacking, AgentState.Waiting])
  [AgentState.Positioning]: AgentStateData = {
    text: AgentState.Positioning
  }

  @StateMachine.extend(AgentState.Positioning, [AgentState.Connecting, AgentState.Attacking, AgentState.LostGame, AgentState.Waiting])
  [AgentState.WaitingForTurn]: AgentStateData = {
    text: AgentState.WaitingForTurn
  }

  @StateMachine.extend(AgentState.WaitingForTurn, [AgentState.Connecting, AgentState.WaitingForTurn, AgentState.WonGame, AgentState.Waiting])
  [AgentState.Attacking]: AgentStateData = {
    text: AgentState.Attacking
  }

  @StateMachine.extend(AgentState.WaitingForTurn)
  [AgentState.LostGame]: AgentStateData = {
    text: AgentState.LostGame
  }

  @StateMachine.extend(AgentState.Attacking)
  [AgentState.WonGame]: AgentStateData = {
    text: AgentState.WonGame
  }

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
