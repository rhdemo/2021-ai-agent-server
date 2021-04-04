import fastify from 'fastify';
import { HTTP_PORT, NODE_ENV } from './config';
import log from './log';

const { version } = require('../package.json');
const app = fastify({ logger: NODE_ENV !== 'prod' });

// Provides a health endpoint to check
app.register(require('./plugins/health'), {
  options: {
    version
  }
});

// Allows CRUD on AI Agent instances
app.register(require('./plugins/agents'), {
  options: {}
});

export default async function startServer() {
  try {
    await app.listen(HTTP_PORT, '0.0.0.0');
    log.info(`server started listening on 0.0.0.0:${HTTP_PORT}`);
    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
