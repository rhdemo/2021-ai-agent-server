
import log from "../log";
import Agent, { AgentInitialisationOptions } from "./agent";

const agents = new Map<string, Agent>()

export function createAgent (opts: AgentInitialisationOptions) {
  const { uuid } = opts
  if (agents.has(uuid)) {
    throw new Error(`an agent with the UUID ${uuid} already exists`)
  } else {
    log.info('Creating agent with opts: %j', opts)
    agents.set(uuid, new Agent(opts))
  }
}

export function getAgentCount () {
  return agents.size
}
