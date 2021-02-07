import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { createAgent } from '../agents/'
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
    username: string
    uuid: string
  }

  server.post<{ Body: CreateAgentBody }>('/agent', async (req, reply) => {
    const { uuid, username } = req.body

    if (!uuid || !username) {
      reply.status(400).send({
        info: '"uuid" and "username" are required to create an agent'
      })
    } else {
      createAgent({ uuid, username, gridSize: GAME_GRID_SIZE, wsUrl: GAME_SERVER_URL })
      reply.send({
        info: 'successfully created agent'
      })
    }
  })

  done();
};

export default fp(agentPlugin);
