import { GAME_GRID_SIZE, GAME_SERVER_URL } from '../config';
import log from '../log';
import Agent from './agent';

const agents = new Map<string, Agent>();

type AgentOptions = {
  uuid: string;
  username: string;
  gameId: string;
  wsUrl?: string;
};

export function createAgent(opts: AgentOptions) {
  const { uuid, wsUrl = GAME_SERVER_URL } = opts;
  const existingAgent = agents.get(uuid);

  if (existingAgent) {
    // Retire the old agent. This is the safest course of action since the
    // new agent might need to connect to a new game-server pod/host, etc.
    log.warn(
      `An agent with the UUID ${uuid} existed already. Deleting this stale agent.`
    );

    existingAgent.retire();
  }

  log.info(
    `Creating agent ${uuid} with opts for game %s: %j`,
    opts.gameId,
    opts
  );

  const agent = new Agent({
    ...opts,
    wsUrl,
    gridSize: GAME_GRID_SIZE,
    // Remove agent from the Map the they have won/lost
    onRetired: () => agents.delete(uuid)
  });

  agents.set(uuid, agent);
}

export function getAgentCount() {
  return agents.size;
}
