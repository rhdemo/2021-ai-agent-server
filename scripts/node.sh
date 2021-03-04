DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Default to not using an AI prediction service. Agents will make simple
# random attacks without any intelligent strategy
AI_SERVER_URL=${AI_SERVER_URL:-""}

docker build -f Dockerfile.dev . -t summit-ai-agent-server
docker run -e AI_SERVER_URL="$AI_SERVER_URL" --rm --net=infinispan-docker-compose_summit -p 3003:3003 -v "$(pwd)/src/:/usr/src/app/src/" --name=summit-ai-agent-server  summit-ai-agent-server
