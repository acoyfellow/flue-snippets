/**
 * gateproof plan for ai-gateway.
 *
 * One gate: probe.ts asserts the worker reaches Workers AI through the
 * Cloudflare AI Gateway (env.AI binding with `gateway: { id }`) and
 * returns a real model answer.
 *
 * Required env: AGENT_URL
 */

import { Plan, Gate, Act, Assert, Require } from 'gateproof';
import { Effect } from 'effect';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const plan = Plan.define({
  goals: [
    {
      id: 'agent-routes-through-gateway',
      title: 'Worker reaches Workers AI via AI Gateway and returns a real answer',
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
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
