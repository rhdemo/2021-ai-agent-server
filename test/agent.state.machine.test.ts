
import { StateMachine } from '@evanshortiss/tstate-machine'
import { findSourceMap } from 'module'
import test from 'tape'
import  AgentStateMachine, { AgentState } from '../src/agents/agent.state.machine'

test('able to return to waiting state from any state', (t) => {
  const sm = new AgentStateMachine()

  const flow = [
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Positioning,
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.Waiting,
    AgentState.Attacking,
    AgentState.WaitingForTurn,
    AgentState.Waiting
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})

test('verify that "Connecting" state can be entered from various states', (t) => {
  const sm = new AgentStateMachine()

  const flow = [
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Positioning,

    // Ooops, we got disconnected!
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Attacking,

    // Ooops, we got disconnected again!
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.WaitingForTurn
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})

test('verify happy path for states and winning condition', (t) => {
  const sm = new AgentStateMachine()

  const flow = [
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Positioning,
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WonGame
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `wanted "${s}", but machine is in "${sm.currentState}"`)
  })

  t.end()
})

test('verify happy path for states and losing condition', (t) => {
  const sm = new AgentStateMachine()

  const flow = [
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Positioning,
    AgentState.Attacking,
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WaitingForTurn,
    AgentState.LostGame
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `wanted "${s}", but machine is in "${sm.currentState}"`)
  })

  t.end()
})
