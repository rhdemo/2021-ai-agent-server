import fastify from 'fastify';
import { HTTP_PORT } from './config';

const { version } = require('../package.json');
const app = fastify({ logger: true });

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

    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
