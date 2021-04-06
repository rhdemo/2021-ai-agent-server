'use strict'

/**
 * This script can be used to create bot players. This is useful to test one
 * prediction model versus another, or to load test the game backend services.
 *
 * Usage:
 *    - To get pretty log output install pino pretty "npm install -g pino-pretty" first.
 *    - AI_SERVER_URL=http://the.ai.server/ BOT_COUNT=10 BOT_WS_URL=ws://the.game.server/game node scripts/bots.js | pino-pretty -t
 */

const { get } = require('env-var')
const Agent = require('../build/agents/agent').default

const BOT_COUNT = get('BOT_COUNT').required().example('BOT_COUNT=10').asIntPositive()
const BOT_WS_URL = get('BOT_WS_URL').required().example('BOT_WS_URL=ws://localhost:3000/game').asUrlString()

const agents = []
let retired = 0
let remaining = BOT_COUNT

/**
 * Creates an agent (bot) and connects to the BOT_WS_URL.
 * This is called recursively until the BOT_COUNT is reached.
 * @returns
 */
function createAgent () {
  if (remaining <= 0) {
    return
  }

  remaining--

  console.log('Creating an agent')

  const connectDelay = getConnectionDelay()
  const agent = new Agent({
    // uuid: string;
    wsUrl: BOT_WS_URL,
    // username: string;
    gridSize: 5,
    // gameId: string;
    onRetired: () => console.log(`Retired agent #${++retired}`)
  })

  agents.push(agent)

  console.log(`${agents.length} have been created so far. Next agent will connect in ${connectDelay}ms`)

  setTimeout(createAgent, connectDelay)
}

/**
 * Generates a random connection delay time in milliseconds.
 * This ensures that *at least* 10 bots connect per second.
 * @returns
 */
function getConnectionDelay () {
  const min = 50
  const max = 100
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

createAgent()
