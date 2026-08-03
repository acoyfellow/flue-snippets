import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const agentUrlBase = process.env.AGENT_URL_BASE;
const eventHmacSecret = process.env.EVENT_HMAC_SECRET;
if (!agentUrlBase) throw new Error('AGENT_URL_BASE is required');
if (!eventHmacSecret) throw new Error('EVENT_HMAC_SECRET is required');

const execute = (mode: string) => Act.exec(
  `AGENT_URL_BASE="${agentUrlBase}" EVENT_HMAC_SECRET="${eventHmacSecret}" bun run probe.ts ${mode}`,
  { timeoutMs: 240_000 },
);
const prerequisites = [
  Require.env('AGENT_URL_BASE', 'deployed worker URL'),
  Require.env('EVENT_HMAC_SECRET', 'shared HMAC secret'),
];
const gate = (id: string, title: string, mode: string) => ({
  id,
  title,
  gate: Gate.define({ prerequisites, act: [execute(mode)], assert: [Assert.noErrors()], timeoutMs: 270_000 }),
});

const plan = Plan.define({
  goals: [
    gate('rejects-unsigned', 'Unsigned events are rejected before admission', 'unsigned'),
    gate('rejects-wrong-signature', 'Events with invalid signatures are rejected before admission', 'wrong-signature'),
    gate('routes-sentry', 'Signed Sentry events are normalized and routed', 'sentry'),
    gate('routes-pagerduty', 'Signed PagerDuty events are normalized and routed', 'pagerduty'),
    gate('routes-gitlab-ci', 'Signed GitLab CI events are normalized and routed', 'gitlab-ci'),
    gate('routes-cron', 'Signed cron events are normalized and routed', 'cron'),
  ],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
