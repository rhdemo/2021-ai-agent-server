import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { AgentCreationResponse, createAgent } from '../agents/';

const agentPlugin: FastifyPluginCallback = (server, options, done) => {
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
      const result = createAgent({ uuid, username, gameId });

      if (result === AgentCreationResponse.Created) {
        reply.send({
          info: 'successfully created agent'
        });
      } else {
        reply.send({
          info: 'agent was created previously'
        });
      }
    }
  });

  done();
};

export default fp(agentPlugin);
