/**
 * gateproof plan for snippet 01 (lab-receipt).
 *
 * Asserts the deployed Worker:
 *   1. POST /agents/lab-receipt/<id> succeeds (exit 0 from curl + real
 *      JSON response containing "receipt")
 *   2. The Lab origin is reachable and reports its catalog version
 *
 * Two gates, two evidence sources:
 *   - Gate 1 uses `act: [Act.exec(curl-with-fail-fast)]` + Assert.noErrors().
 *     Curl exits non-zero on HTTP 4xx/5xx (because of -fsS), so a clean
 *     exit means the agent really returned 200 with a real body. The
 *     exec stdout is captured in evidence so a reader can verify the
 *     receipt URL.
 *   - Gate 2 uses `observe: { kind: 'http' }` + Assert.httpResponse +
 *     Assert.responseBodyIncludes against /lab/catalog.
 *
 * Required env:
 *   AGENT_URL  — deployed Flue agent URL (POST target)
 *   LAB_URL    — Lab origin (defaults https://lab.coey.dev)
 *
 * Run:
 *   AGENT_URL=https://flue-...workers.dev/agents/lab-receipt/run \
 *     bun run gateproof.plan.ts
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
      id: 'agent-deploys-and-runs',
      title: 'Snippet 01 deployed Worker accepts a real prompt and returns 200',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [
          // -fsS: fail on 4xx/5xx, silent progress, show errors. Means
          // exit 0 is real proof of a 200 with a body.
          Act.exec(
            `curl -fsS -X POST "${AGENT_URL}" ` +
              `-H 'content-type: application/json' ` +
              `-d '{"message":"hello from gateproof"}'`,
            { timeoutMs: 120_000 },
          ),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 150_000,
      }),
    },
    {
      id: 'lab-origin-reachable',
      title: 'The Lab origin (where receipts live) returns its catalog',
      gate: Gate.define({
        observe: { kind: 'http', url: `${LAB_URL}/lab/catalog`, pollInterval: 0 },
        assert: [
          Assert.httpResponse({ status: 200 }),
          Assert.responseBodyIncludes('"version"'),
        ],
        timeoutMs: 10_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
