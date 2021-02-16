'use strict';

import { get } from 'env-var';

const config = {
  NODE_ENV: get('NODE_ENV').default('dev').asEnum(['dev', 'prod']),
  LOG_LEVEL: get('LOG_LEVEL').asString(),

  // HTTP and WebSocket traffic both use this port
  HTTP_PORT: get('HTTP_PORT').default(3003).asPortNumber(),

  // This is the grid size for the game, e.g "5" would produce a 5x5 grid
  GAME_GRID_SIZE: get('GAME_GRID_SIZE').default(5).asIntPositive(),

  GAME_SERVER_URL: get('GAME_SERVER_URL').default('ws://game-server.frontend.svc.cluster.local:8080/game').asUrlString(),

  DATAGRID_GAME_DATA_STORE: get('DATAGRID_GAME_DATA_STORE')
    .default('game')
    .asString(),
  DATAGRID_GAME_DATA_KEY: get('DATAGRID_GAME_DATA_KEY')
    .default('current-game')
    .asString(),
  DATAGRID_PLAYER_DATA_STORE: get('DATAGRID_PLAYER_DATA_STORE')
    .default('players')
    .asString(),
  DATAGRID_HOST: get('DATAGRID_HOST').default('infinispan').asString(),
  DATAGRID_HOTROD_PORT: get('DATAGRID_HOTROD_PORT')
    .default(11222)
    .asPortNumber()
};

export = config;
