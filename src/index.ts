import startServer from './server';
import log from './log';

require('make-promises-safe');

async function main() {
  log.info('bootstrapping AI agents server');

  const app = await startServer();
}

main();
