'use strict';

import { get } from 'env-var';

const config = {
  NODE_ENV: get('NODE_ENV').default('dev').asEnum(['dev', 'prod']),
  LOG_LEVEL: get('LOG_LEVEL').asString(),

  // HTTP and WebSocket traffic both use this port
  HTTP_PORT: get('HTTP_PORT').default(3003).asPortNumber(),

  // This is the grid size for the game, e.g "5" would produce a 5x5 grid
  GAME_GRID_SIZE: get('GAME_GRID_SIZE').default(5).asIntPositive(),

  GAME_SERVER_URL: get('GAME_SERVER_URL')
    .default('ws://game-server.frontend.svc.cluster.local:8080/game')
    .asUrlString(),

  AI_SERVER_URL: get('AI_SERVER_URL').required().asUrlString(),

  MIN_ATTACK_DELAY: get('MIN_ATTACK_DELAY').default(3250).asIntPositive(),

  AGENT_SEND_DELAY: get('AGENT_SEND_DELAY').default(1000).asIntPositive()
};

export = config;
