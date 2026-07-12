/**
 * gateproof plan for event-trigger.
 *
 * Six gates:
 *   1. rejects-unsigned      , POST with no _sig → 401
 *   2. rejects-wrong-sig     , POST with a bad HMAC → 401
 *   3. routes-sentry         , signed fatal Sentry error → 200, critical, page/notify
 *   4. routes-pagerduty      , signed triggered incident → 200, critical, page/notify
 *   5. routes-gitlab-ci      , signed failed pipeline → 200, high, page/notify
 *   6. routes-cron           , signed cron tick → 200, info, log/notify
 *
 * Together they prove: one generic HMAC gate authenticates every
 * upstream, the per-source normalizer collapses N provider shapes into
 * one canonical event, and the Flue routing skill returns a structured,
 * severity-appropriate decision.
 *
 * Required env: AGENT_URL_BASE, EVENT_HMAC_SECRET
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
const EVENT_HMAC_SECRET = process.env.EVENT_HMAC_SECRET;

if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}
if (!EVENT_HMAC_SECRET) {
  console.error('EVENT_HMAC_SECRET is required');
  process.exit(2);
}

const exec = (mode: string) =>
  Act.exec(
    `AGENT_URL_BASE="${AGENT_URL_BASE}" EVENT_HMAC_SECRET="${EVENT_HMAC_SECRET}" bun run probe.ts ${mode}`,
    { timeoutMs: 240_000 },
  );

const prereqs = [
  Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/event-trigger'),
  Require.env('EVENT_HMAC_SECRET', 'shared HMAC secret for event bodies'),
];

const goal = (id: string, title: string, mode: string) => ({
  id,
  title,
  gate: Gate.define({
    prerequisites: prereqs,
    act: [exec(mode)],
    assert: [Assert.noErrors()],
    timeoutMs: 270_000,
  }),
});

const plan = Plan.define({
  goals: [
    goal('rejects-unsigned', 'POST without a signature is rejected with 401', 'unsigned'),
    goal(
      'rejects-wrong-sig',
      'POST with a malformed signature is rejected with 401',
      'wrong-signature',
    ),
    goal('routes-sentry', 'Signed Sentry fatal error normalizes to critical and routes', 'sentry'),
    goal(
      'routes-pagerduty',
      'Signed PagerDuty incident normalizes to critical and routes',
      'pagerduty',
    ),
    goal(
      'routes-gitlab-ci',
      'Signed GitLab failed pipeline normalizes to high and routes',
      'gitlab-ci',
    ),
    goal('routes-cron', 'Signed cron tick normalizes to info and is logged', 'cron'),
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
