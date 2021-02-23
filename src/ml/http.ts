import got, { OptionsOfJSONResponseBody } from 'got';
import { Agent } from 'http';

const DEFAULT_AGENTS: OptionsOfJSONResponseBody['agent'] = {
  // TODO: maybe try the new undici http library?
  // Using keep-alive agents can massively improve performance/throughput
  http: new Agent({
    keepAlive: true
  })
};

/**
 * Reusable http function. Uses agents with keepAlive=true to boost performance
 * @param url
 * @param opts
 * @param agent
 */
export default function http(
  url: string,
  opts: OptionsOfJSONResponseBody,
  agent = DEFAULT_AGENTS
) {
  return got(url, {
    agent,
    ...opts
  });
}
