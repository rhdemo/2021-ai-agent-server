
import test from 'tape'
import WebSocket from 'ws'
import Agent from '../src/agents/agent'
import { AgentState } from '../src/agents/agent.state.machine'
import { IncomingMessageStruct, ConfigMessagePayload, MessageType } from '../src/types'

const AGENT_CONFIG = {
  uuid: 'agent-uuid',
  username: 'agent-username',
}
const OPPONENT_CONFIG = {
  uuid: 'opponent-uuid',
  username: 'opponent-username'
}
const SOCKET_SERVER_PORT = 9123
const SOCKET_SERVER_URL = `ws://localhost:${SOCKET_SERVER_PORT}`
const CONFIG: ConfigMessagePayload = {
  game: {
    uuid: 'game-uuid',
    date: new Date().toJSON(),
    state: 'active'
  },
  player: {
    uuid: AGENT_CONFIG.uuid,
    username: AGENT_CONFIG.username,
    attacks: []
  },
  match: {
    uuid: 'match-uuid',
    ready: true,
    activePlayer: OPPONENT_CONFIG.uuid
  }
}

test('verify agent behaviour', (t) => {
  const server = new WebSocket.Server({ port: SOCKET_SERVER_PORT })
  const { uuid, username } = AGENT_CONFIG

  server.once('listening', () => {
    server.on('error', (e) => t.end(e))
    server.on('connection', (sock) => {
      // This dummy server can track the Agent state easily based on
      // a counter since the order is predetermined
      let stateCounter = 0
      const states = [
        MessageType.Outgoing.Connection,
        MessageType.Outgoing.ShipPositions,
        MessageType.Outgoing.Attack,
        MessageType.Outgoing.Attack
      ]

      sock.on('message', (message) => {
        const payload = JSON.parse(message.toString()) as IncomingMessageStruct<ConfigMessagePayload>
        const expected = states[stateCounter++]

        t.equal(expected, payload.type, `payload should be "${expected}"`)

        if (expected === MessageType.Outgoing.Connection) {
          sock.send(JSON.stringify({
            type: MessageType.Incoming.Configuration,
            data: CONFIG
          }))
        } else if (expected === MessageType.Outgoing.ShipPositions) {
          // No validation, just accept the positions
          CONFIG.player.board = {
            valid: true
          }
          sock.send(JSON.stringify({
            type: MessageType.Incoming.Configuration,
            data: CONFIG
          }))

          setTimeout(() => {
            // Tell the Agent it's their turn a short time later
            CONFIG.match.activePlayer = AGENT_CONFIG.uuid
            sock.send(JSON.stringify({
              type: MessageType.Incoming.AttackResult,
              data: CONFIG
            }))
          }, 500)
        } else if (expected === MessageType.Outgoing.Attack) {
          if (stateCounter === 3) {
            // Switch the activePlayer to the opponent
            CONFIG.match.activePlayer = OPPONENT_CONFIG.uuid
            sock.send(JSON.stringify({
              type: MessageType.Incoming.AttackResult,
              data: CONFIG
            }))

            setTimeout(() => {
              // Switch the activePlayer to the agent again
              CONFIG.match.activePlayer = AGENT_CONFIG.uuid
              sock.send(JSON.stringify({
                type: MessageType.Incoming.AttackResult,
                data: CONFIG
              }))
            }, 100)
          } else {
            CONFIG.match.winner = AGENT_CONFIG.uuid
            sock.send(JSON.stringify({
              type: MessageType.Incoming.AttackResult,
              data: CONFIG
            }))
            // Wait for the agent to update their internal state and verify it
            setTimeout(() => {
              t.equal(agent.getCurrentState(), AgentState.WonGame)
              server.close((e) => t.end(e))
            }, 100)
          }
        } else {
          t.end(new Error('Missing condition for Agent payload'))
        }
      })
    })

    const agent = new Agent({
      uuid, username, wsUrl: SOCKET_SERVER_URL, gridSize: 5
    })
  })


})


