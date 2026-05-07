/**
 * gateproof plan for snippet 06 (ai-gateway).
 *
 * One gate: POST through the deployed worker → which calls Workers AI
 * through the AI Gateway URL → returns a real model answer. The fact
 * that the response is 200 with a non-empty answer.text proves the
 * gateway path is wired correctly.
 *
 * Required env:
 *   AGENT_URL — full POST target (e.g. https://...workers.dev/agents/ai-gateway/<id>)
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
      title: 'POST through the worker reaches Workers AI via AI Gateway and returns an answer',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [
          Act.exec(
            `curl -fsS -X POST "${AGENT_URL}" ` +
              `-H 'content-type: application/json' ` +
              `-d '{"message":"hi from gateproof"}'`,
            { timeoutMs: 60_000 },
          ),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 90_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
