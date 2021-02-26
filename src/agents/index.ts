import { GAME_GRID_SIZE, GAME_SERVER_URL } from '../config';
import log from '../log';
import Agent from './agent';

const agents = new Map<string, Agent>();

type AgentOptions = {
  uuid: string;
  username: string;
  gameId: string;
};

export function createAgent(opts: AgentOptions) {
  const { uuid } = opts;

  if (agents.has(uuid)) {
    throw new Error(`an agent with the UUID ${uuid} already exists`);
  } else {
    log.info('Creating agent with opts: %j', opts);

    const agent = new Agent({
      ...opts,
      wsUrl: GAME_SERVER_URL,
      gridSize: GAME_GRID_SIZE,
      // Remove agent from the Map the they have won/lost
      onRetired: () => agents.delete(uuid)
    });

    agents.set(uuid, agent);
  }
}

export function getAgentCount() {
  return agents.size;
}
