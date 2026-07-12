import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { type CanonicalEvent, type EventSource, normalize } from '../lib/normalize';
import { verifySignature } from '../lib/verify-signature';

// recipes/event-trigger — one signed-webhook front door that runs a Flue
// routing workflow on any upstream event (Sentry, PagerDuty, GitLab CI, cron).
// The common denominator: every source can send a signed webhook. Flue 1.0
// workflow: verify one generic HMAC → normalize to a CanonicalEvent → route
// (structured output). Auth failures are returned in the body as
// { ok:false, status:401 } (workflows always resolve 200 on ?wait=result).

interface Env {
  EVENT_HMAC_SECRET: string;
}

const SOURCES: EventSource[] = ['sentry', 'pagerduty', 'gitlab-ci', 'cron', 'generic'];

const routeSchema = v.object({
  action: v.picklist(['page', 'notify', 'log']),
  channel: v.string(),
  reason: v.string(),
});

const ROUTING_RUBRIC = [
  'You are a routing step in an event-driven Flue workflow. Given a normalized',
  'event from an upstream service, decide what the workflow should do.',
  '',
  'Choose `action`:',
  '  - "page": wake a human now. Use for critical severity, or a triggered incident.',
  '  - "notify": post to a team channel. Use for high or medium severity.',
  '  - "log": record only, no human in the loop. Use for low/info severity and cron ticks.',
  'Choose `channel`: a short slug for where the action goes (e.g. "oncall",',
  '  "eng-alerts", "audit-log") that matches the action.',
  'Write `reason`: one sentence explaining the decision.',
].join('\n');

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({
    source: v.optional(v.string()),
    event: v.optional(v.record(v.string(), v.unknown())),
    _sig: v.optional(v.string()),
  }),
  output: v.object({
    ok: v.boolean(),
    status: v.optional(v.number()),
    error: v.optional(v.string()),
    handled: v.optional(v.string()),
    event: v.optional(v.unknown()),
    route: v.optional(routeSchema),
  }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const source: EventSource = SOURCES.includes(input.source as EventSource)
      ? (input.source as EventSource)
      : 'generic';
    const eventBody = (input.event ?? {}) as Record<string, unknown>;
    const signature = input._sig ?? '';
    const rawBody = JSON.stringify(eventBody);
    if (!signature) return { ok: false, status: 401, error: 'missing_signature' };
    if (!(await verifySignature(e.EVENT_HMAC_SECRET, rawBody, signature))) {
      return { ok: false, status: 401, error: 'invalid_signature' };
    }
    const canonical: CanonicalEvent = normalize(source, eventBody);
    const session = await harness.session();
    const { data } = await session.prompt(
      [
        ROUTING_RUBRIC,
        '',
        'Event:',
        `  source: ${canonical.source}`,
        `  kind: ${canonical.kind}`,
        `  title: ${canonical.title}`,
        `  severity: ${canonical.severity}`,
        `  service: ${canonical.service ?? '(none)'}`,
      ].join('\n'),
      { result: routeSchema },
    );
    return {
      ok: true,
      handled: `${canonical.source}:${canonical.kind}`,
      event: {
        source: canonical.source,
        kind: canonical.kind,
        title: canonical.title,
        severity: canonical.severity,
        service: canonical.service,
        url: canonical.url,
      },
      route: data,
    };
  },
});
