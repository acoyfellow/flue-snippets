/**
 * gateproof plan for gateway-lab.
 *
 * Two gates:
 *   1. probe.ts asserts the worker routes through AI Gateway, gets a
 *      model answer, AND persists a receipt that lab serves back.
 *   2. The Lab origin is reachable and reports its catalog.
 */

import { Plan, Gate, Act, Assert, Require } from 'gateproof';
import { Effect } from 'effect';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';

const plan = Plan.define({
  goals: [
    {
      id: 'gateway-and-lab-both-record',
      title: 'Worker routes through AI Gateway and persists a Lab receipt',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [
          Act.exec(`AGENT_URL="${AGENT_URL}" bun run probe.ts`, {
            timeoutMs: 150_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'lab-origin-reachable',
      title: 'The Lab origin returns its catalog',
      gate: Gate.define({
        observe: { kind: 'http', url: `${LAB_URL}/lab/catalog`, pollInterval: 0 },
        assert: [
          Assert.httpResponse({ status: 200 }),
          Assert.responseBodyIncludes('"version"'),
        ],
        timeoutMs: 15_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
