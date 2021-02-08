
import { StateMachine } from '@evanshortiss/tstate-machine'
import { Agent } from 'http'
import { findSourceMap } from 'module'
import test from 'tape'
import  AgentStateMachine, { AgentState } from '../src/agents/agent.state.machine'

test('disconnected state can be entered at any time', (t) => {
  const sm = new AgentStateMachine()

  const flow = [
    // Start of by connecting, and attack
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Positioning,
    AgentState.WaitingForTurn,
    AgentState.Attacking,

    // Our connection dropped, oops!
    AgentState.Disconnected,
    AgentState.Connecting,

    // Connection attempt failed
    AgentState.Disconnected,

    // Awesome, we managed to reconnect
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,

    // Got disconnected again, but managed to connect and attack
    AgentState.Disconnected,
    AgentState.Connecting,
    AgentState.Connected,
    AgentState.WaitingForConfig,
    AgentState.Attacking,
    AgentState.WaitingForTurn,

    // Oh noes, the connection dropped again
    AgentState.Disconnected,
    AgentState.Connecting,
    AgentState.Connected,
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})

test('happy path for states and winning condition', (t) => {
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
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})

test('happy path for states and losing condition', (t) => {
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
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})

test('game can be paused/stopped so Agent waits for a new "active" config', (t) => {
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

    // Game has been "paused"
    AgentState.WaitingForConfig,

    // Game was set to "active" again
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WaitingForTurn,

    // Game has been "paused" again
    AgentState.WaitingForConfig,

    // And now is "active"
    AgentState.WaitingForTurn,
    AgentState.Attacking,
    AgentState.WonGame
  ]

  t.equal(sm.currentState, StateMachine.INITIAL)

  flow.forEach(s => {
    sm.transitTo(s)
    t.equal(sm.currentState, s, `Expceted "${s}". Received "${sm.currentState}"`)
  })

  t.end()
})
