/**
 * gateproof plan for templates/github-app, three gates:
 *   1. rejects-unsigned-requests
 *   2. rejects-wrong-signature
 *   3. accepts-signed-request
 *
 * Required env: AGENT_URL_BASE, GITHUB_WEBHOOK_SECRET
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}
if (!GITHUB_WEBHOOK_SECRET) {
  console.error('GITHUB_WEBHOOK_SECRET is required');
  process.exit(2);
}

const exec = (mode: string) =>
  Act.exec(
    `AGENT_URL_BASE="${AGENT_URL_BASE}" GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET}" bun run probe.ts ${mode}`,
    { timeoutMs: 240_000 },
  );

const plan = Plan.define({
  goals: [
    {
      id: 'rejects-unsigned-requests',
      title: 'POST without a signature header is rejected with 401',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/webhook'),
          Require.env('GITHUB_WEBHOOK_SECRET', 'shared HMAC secret'),
        ],
        act: [exec('unsigned')],
        assert: [Assert.noErrors()],
        timeoutMs: 270_000,
      }),
    },
    {
      id: 'rejects-wrong-signature',
      title: 'POST with a malformed signature is rejected with 401',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE'),
          Require.env('GITHUB_WEBHOOK_SECRET'),
        ],
        act: [exec('wrong-signature')],
        assert: [Assert.noErrors()],
        timeoutMs: 270_000,
      }),
    },
    {
      id: 'accepts-signed-request',
      title: 'Correctly signed issues.opened payload is triaged and returns 200',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE'),
          Require.env('GITHUB_WEBHOOK_SECRET'),
        ],
        act: [exec('signed')],
        assert: [Assert.noErrors()],
        timeoutMs: 270_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
