/**
 * gateproof plan for chat-thinking.
 *
 * One gate: probe.ts runs two turns against the same chatId, asserting
 * the Think DO actually held the conversation state (turn 2 recalls the
 * fact set in turn 1).
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
      id: 'chat-thinking-memory-persists',
      title: 'Two POSTs to the same chatId share state via the per-chat Think DO',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/chat-thinking')],
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
