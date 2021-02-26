import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { createAgent } from '../agents/';
import { GAME_GRID_SIZE, GAME_SERVER_URL } from '../config';

export interface AgentPluginOptions {
  version: string;
}

const agentPlugin: FastifyPluginCallback<AgentPluginOptions> = (
  server,
  options,
  done
) => {
  type CreateAgentBody = {
    username: string;
    uuid: string;
    gameId: string;
  };

  server.post<{ Body: CreateAgentBody }>('/agent', async (req, reply) => {
    const { uuid, username, gameId } = req.body;

    if (!uuid || !gameId || !username) {
      reply.status(400).send({
        info: '"uuid", "gameId" and "username" are required to create an agent'
      });
    } else {
      createAgent({ uuid, username, gameId });
      reply.send({
        info: 'successfully created agent'
      });
    }
  });

  done();
};

export default fp(agentPlugin);
