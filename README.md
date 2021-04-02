# AI Agent

Server that can be used to spin up "Agents" or "bots" that act as players, but
use an AI service to choose their moves. If no AI service URL is configured
Agents will use a simple top-left to bottom-right attack strategy.

## Requirements

* Node.js v14
* npm v6
* Docker
* Running [AI Service](https://github.com/sub-mod/bataai.git)

## Local Development

Local development uses a Docker container that mounts in the *src/* directory.

You must set the `AI_SERVER_URL` variable to a valid AI service URL:

```bash
AI_SERVER_URL=http://your-ai.service.com/ ./scripts/node.sh
```

## Configuration

Environment variables can be used to configure runtime behaviour:

* NODE_ENV - Set to `dev` or `prod`
* LOG_LEVEL - Set to `trace`, `debug`, `info` etc. Defaults to `info` if `NODE_ENV=prod`, or `trace` if `NODE_ENV=dev`.
* HTTP_PORT - Defaults to 3003. Local development overrides this to
* GAME_GRID_SIZE - Defaults to 5. This must match the corresponding game server value.
* GAME_SERVER_URL - A WebSocket URL to the game server. Defaults to `ws://game-server.frontend.svc.cluster.local:8080/game`
* AI_SERVER_URL - A HTTP URL to the move prediction service.
* MIN_ATTACK_DELAY - Forces the Agent to "think" (wait) before sending an attack. Defaults to `3500` milliseconds.
* AGENT_SEND_DELAY - A minimum delay placed on all outgoing WebSocket messages. Defaults to `500` milliseconds.

## API Usage

Send a request to `POST /agent` with a body using this format:

```json
{
  "uuid": "random-uuid",
  "username": "random-username",
  "gameId": "random-uuid"
}
```

This will create an Agent that connects to the
[Game WebSocket Server](https://github.com/rhdemo/2021-ai-agent-server) and
return a 200 OK.

The body in the POST request must refer to a player that has been created and
stored in the Infinispan cache by the Game WebSocket Server.

If the agent already exists then the request returns a 200 OK and a message
stating that the Agent has already been created.

## Running Local Bots vs. Game Server

The *scripts/bots.js* can be used to create bots that play the game. This is
useful for load testing the backend, testing AI models against one another,
and generally simulating activity.

Usage:

```bash
# Optional LOG_LEVEL info/warn is best unless you need to track down a bug
export LOG_LEVEL=info

# URL to retrieve move predictions from
export AI_SERVER_URL=http://some-ai.server-on.openshiftapps.com

# Number of AI bots to create
export BOT_COUNT=5

# Game server to connect to
export BOT_WS_URL=ws://som-game.server-on.openshiftapps.com/game

# Compile the code and create $BOT_COUNT bots that will play against
# opponents (probably other bots!) on the $BOT_WS_URL game server
npm run bots
```
