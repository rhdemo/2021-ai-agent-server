import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { uptime } from 'process';
import humanize from 'humanize-duration';
import { getAgentCount } from '../agents';

export interface HealthPluginOptions {
  version: string;
}

const healthPlugin: FastifyPluginCallback<HealthPluginOptions> = (
  server,
  options,
  done
) => {
  server.route({
    method: 'GET',
    url: '/health',
    handler: async () => {
      return {
        status: 'ok',
        agentCount: getAgentCount(),
        uptime: humanize(uptime() * 1000),
        serverTs: new Date().toJSON(),
        version: options.version
      };
    }
  });

  done();
};

export default fp(healthPlugin);
