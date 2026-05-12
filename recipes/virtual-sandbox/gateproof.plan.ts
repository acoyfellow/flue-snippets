/**
 * gateproof plan for virtual-sandbox.
 *
 * One gate: probe.ts POSTs a question whose answer is only present in
 * the R2-backed virtual filesystem. If the sandbox mount works, the
 * agent will grep the doc and return the seeded fact ("octarine").
 *
 * Required env: AGENT_URL_BASE
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const plan = Plan.define({
  goals: [
    {
      id: 'virtual-sandbox-grep-finds-fact',
      title: 'Agent greps an R2-mounted virtual filesystem and surfaces the seeded fact',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/virtual-sandbox'),
        ],
        act: [
          Act.exec(`AGENT_URL_BASE="${AGENT_URL_BASE}" bun run probe.ts`, {
            timeoutMs: 240_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 270_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
