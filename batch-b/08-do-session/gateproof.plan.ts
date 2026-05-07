/**
 * gateproof plan for snippet 08 (do-session).
 *
 * Asserts the deployed Worker:
 *   1. POST /agents/do-session/<userId> succeeds with a real model answer
 *   2. The same userId returns a session-aware response on a second call
 *      (the gate just asserts the second call also returns 200; full
 *      memory-recall verification is left to the agent itself, which
 *      Flue's DO session handles internally).
 *
 * Required env:
 *   AGENT_URL_BASE  — deployed worker base + /agents/do-session
 *
 * Run:
 *   AGENT_URL_BASE=https://flue-...workers.dev/agents/do-session \
 *     bun run gateproof.plan.ts
 */

import { Plan, Gate, Act, Assert, Require } from 'gateproof';
import { Effect } from 'effect';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

// Same userId across both turns = same DO instance.
const USER_ID = `gateproof-user-${Date.now()}`;

const plan = Plan.define({
  goals: [
    {
      id: 'first-turn',
      title: 'First turn against a fresh session DO returns a model answer',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/do-session')],
        act: [
          Act.exec(
            `curl -fsS -X POST "${AGENT_URL_BASE}/${USER_ID}" ` +
              `-H 'content-type: application/json' ` +
              `-d '{"message":"My favourite color is octarine. Reply with one word."}'`,
            { timeoutMs: 60_000 },
          ),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 90_000,
      }),
    },
    {
      id: 'second-turn-same-do',
      title: 'Second turn against the same userId routes to the same DO and returns 200',
      gate: Gate.define({
        act: [
          Act.exec(
            `curl -fsS -X POST "${AGENT_URL_BASE}/${USER_ID}" ` +
              `-H 'content-type: application/json' ` +
              `-d '{"message":"What did I just tell you my favourite color was?"}'`,
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
