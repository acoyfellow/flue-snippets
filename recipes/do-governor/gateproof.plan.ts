/**
 * gateproof plan for snippet 16 (do-governor).
 *
 * Two gates verify the run governor:
 *   1. First call (no prior state) returns 200 with a real result.
 *   2. After 5 repeated calls (same `lastAction`), the governor
 *      escalates from "continue" to "reanchor" or "ask-human".
 *      The repeat loop runs in `probe.ts` (a bun script), keeps
 *      complex JSON threading out of bash heredocs.
 *
 * Required env:
 *   AGENT_URL_BASE, deployed worker base + /agents/do-governor
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

// Use a stable agent ID so this gate hits the SAME DO instance the
// run-e2e.sh warmup pre-warmed. Without this, every gate pays its own
// fresh-DO cold start (Workers AI on the personal account: 60-180s).
const ID = 'warmup';
const URL = `${AGENT_URL_BASE}/${ID}`;

const plan = Plan.define({
  goals: [
    {
      id: 'first-call-returns-continue',
      title: 'First call (no prior state) returns 200 with a model answer + state',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/do-governor')],
        act: [
          Act.exec(
            `curl -fsS -X POST "${URL}" -H 'content-type: application/json' ` +
              `-d '{"message":"hello","lastAction":"first"}'`,
            { timeoutMs: 120_000 },
          ),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 150_000,
      }),
    },
    {
      id: 'governor-escalates-on-repeat',
      title: 'After 5 repeated calls with same lastAction, decision is no longer "continue"',
      gate: Gate.define({
        act: [
          Act.exec(`AGENT_URL="${URL}" bun run probe.ts`, {
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
