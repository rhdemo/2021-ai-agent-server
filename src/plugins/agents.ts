import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { createAgent } from '../agents/';

const agentPlugin: FastifyPluginCallback = (server, options, done) => {
  type CreateAgentBody = {
    username: string;
    uuid: string;
    gameId: string;
    wsUrl?: string;
  };

  server.post<{ Body: CreateAgentBody }>('/agent', async (req, reply) => {
    const { uuid, username, gameId, wsUrl } = req.body;

    if (!uuid || !gameId || !username) {
      reply.status(400).send({
        info: '"uuid", "gameId" and "username" are required to create an agent'
      });
    } else {
      createAgent({ uuid, username, gameId, wsUrl });

      reply.send({
        info: 'successfully created agent'
      });
    }
  });

  done();
};

export default fp(agentPlugin);
