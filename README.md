# AI Agent

Server that can be used to spin up "Agents" that act as players, but use the
AI service to choose their strategy.

## Usage

Send a request to `POST /agent` with a body using this format:

```
{
  "uuid": "random-uui",
  "username": "Strong Captain"
}
```
