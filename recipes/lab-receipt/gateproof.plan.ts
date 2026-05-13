/**
 * gateproof plan for lab-receipt.
 *
 * Two gates:
 *   1. The deployed Worker's agent route returns a real model answer
 *      and a receipt URL that lab.coey.dev actually serves.
 *      (Implemented in probe.ts so we don't fight bash heredoc + python
 *      JSON parsing on multi-line model output.)
 *   2. The Lab origin is reachable and reports its catalog.
 *
 * Required env:
 *   AGENT_URL , full POST target
 *   LAB_URL   , Lab origin (defaults https://lab.coey.dev)
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
      id: 'agent-runs-and-emits-receipt',
      title: 'Worker returns 200 with answer + receipt URL; lab serves the receipt',
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
        assert: [Assert.httpResponse({ status: 200 }), Assert.responseBodyIncludes('"version"')],
        timeoutMs: 15_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
