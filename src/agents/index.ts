import { GAME_GRID_SIZE, GAME_SERVER_URL } from '../config';
import log from '../log';
import Agent from './agent';

const agents = new Map<string, Agent>();

type AgentOptions = {
  uuid: string;
  username: string;
  gameId: string;
};

export enum AgentCreationResponse {
  Created,
  Existed
}

export function createAgent(opts: AgentOptions): AgentCreationResponse {
  const { uuid, gameId } = opts;
  const existingAgent = agents.get(uuid);

  if (
    existingAgent &&
    existingAgent.getAgentUUID() === uuid &&
    existingAgent.getAgentGameId() === gameId
  ) {
    log.info(
      `An agent with the UUID ${uuid} for game ${gameId} already exists. Skipping creation.`
    );

    return AgentCreationResponse.Existed;
  } else {
    if (existingAgent) {
      log.warn(
        `An agent with the UUID ${uuid} existed for a previous game. Deleting this stale agent.`
      );
      agents.delete(uuid);
    }

    log.info(`Creating agent ${uuid} with opts: %j`, opts);

    const agent = new Agent({
      ...opts,
      wsUrl: GAME_SERVER_URL,
      gridSize: GAME_GRID_SIZE,
      // Remove agent from the Map the they have won/lost
      onRetired: () => agents.delete(uuid)
    });

    agents.set(uuid, agent);

    return AgentCreationResponse.Created;
  }
}

export function getAgentCount() {
  return agents.size;
}
