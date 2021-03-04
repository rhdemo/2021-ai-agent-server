# AI Agent

Server that can be used to spin up "Agents" that act as players, but use an
AI service to choose their strategy. If no AI service URL is configured Agents
will use a random attack strategy.

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

## Usage

Send a request to `POST /agent` with a body using this format:

```json
{
  "uuid": "random-uuid",
  "username": "random-username",
  "gameId": "random-uuid"
}
```

This will create an Agent that connects to the
[Game WebSocket Server](https://github.com/rhdemo/2021-ai-agent-server). The
body in the POST request must refer to a player that has been created and
stored in the Infinispan cache by the Game WebSocket Server.
