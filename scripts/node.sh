DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

docker build -f Dockerfile.dev . -t summit-ai-agent-server
docker run -e AI_SERVER_URL=$AI_SERVER_URL -e GAME_SERVER_URL=ws://summit-frontend-wss:3000/game -e HUSKY_SKIP_HOOKS=1 --rm --net=infinispan-docker-compose_summit -p 3003:3003 -v "$(pwd)/src/:/usr/src/app/src/" --name=summit-ai-agent-server  summit-ai-agent-server
