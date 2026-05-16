/**
 * gateproof plan for dynamic-workflow.
 *
 * One gate: probe.ts enqueues three tasks via the Flue agent, polls
 * status until the Workflow instance reports complete, and asserts
 * all three tasks were drained in the order enqueued — proving the
 * runtime-materialized `step.do()` loop actually ran.
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
      id: 'dynamic-workflow-drains-do-queue-in-order',
      title: 'Flue agent + DO queue + Cloudflare Workflow process tasks materialized at runtime',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/dynamic-workflow'),
        ],
        act: [
          Act.exec(`AGENT_URL_BASE="${AGENT_URL_BASE}" bun run probe.ts`, {
            timeoutMs: 180_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 200_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
