/**
 * gateproof plan for lab-checkpoint.
 *
 * Three gates:
 *   1. First call (cycle becomes 1) checkpoints — response has a
 *      `receipt` URL that lab actually serves. (probe-first.ts)
 *   2. Mid-cycle call (cycle=1 with every=3) does NOT checkpoint —
 *      response lacks a `receipt` field. (probe-mid.ts)
 *   3. The Lab origin is reachable and reports its catalog.
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';

const plan = Plan.define({
  goals: [
    {
      id: 'first-call-checkpoints',
      title: 'First call returns a receipt URL and lab serves it back',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [
          Act.exec(`AGENT_URL="${AGENT_URL}" bun run probe-first.ts`, {
            timeoutMs: 150_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'mid-cycle-skips',
      title: 'Mid-cycle call (cycle=1 with every=3) does NOT checkpoint',
      gate: Gate.define({
        act: [
          Act.exec(`AGENT_URL="${AGENT_URL}" bun run probe-mid.ts`, {
            timeoutMs: 120_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 150_000,
      }),
    },
    {
      id: 'lab-origin-reachable',
      title: 'The Lab origin returns its catalog',
      gate: Gate.define({
        observe: { kind: 'http', url: `${LAB_URL}/lab/catalog`, pollInterval: 0 },
        assert: [Assert.httpResponse({ status: 200 }), Assert.responseBodyIncludes('"version"')],
        timeoutMs: 15_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
