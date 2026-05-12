/**
 * gateproof plan for github-triage.
 *
 * One gate: probe.ts POSTs a synthetic issue payload and asserts the
 * structured triage shape — severity is one of the enum values,
 * reproducible is a boolean (and true for the chosen fixture),
 * summary is a non-empty string.
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
      id: 'github-triage-structured-output',
      title: 'Flue skill() with a valibot schema returns a typed triage object',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/github-triage'),
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
