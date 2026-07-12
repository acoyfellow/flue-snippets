/**
 * probe.ts, the real assertion for event-trigger.
 *
 * Modes (selected by argv[2]):
 *   unsigned        , POST with no _sig            → expect result.ok=false (401)
 *   wrong-signature , POST with _sig=sha256=dead…  → expect result.ok=false (401)
 *   sentry          , signed fatal Sentry error    → expect ok, critical severity
 *   pagerduty       , signed triggered incident    → expect ok, critical severity
 *   gitlab-ci       , signed failed pipeline        → expect ok, high severity
 *   cron            , signed cron tick             → expect ok, info severity + action=log
 *
 * Note: Flue 0.7 webhook agents always return HTTP 200 with the handler
 * result under `{ result }`. Auth failures are therefore signalled in the
 * body as `result.ok === false` (with result.status), not via HTTP status.
 *
 * Each signed mode proves three things at once:
 *   1. The generic HMAC gate accepts a correctly-signed body.
 *   2. The per-source normalizer maps the provider shape onto the
 *      canonical event (asserted via event.kind / event.severity).
 *   3. The Flue routing skill returns a structured decision the caller
 *      can act on (action ∈ page|notify|log, non-empty channel/reason).
 *
 * Pure fetch + JSON. No bash heredocs, no python one-liners.
 *
 * Required env: AGENT_URL_BASE, EVENT_HMAC_SECRET
 */

const BASE = process.env.AGENT_URL_BASE;
const SECRET = process.env.EVENT_HMAC_SECRET ?? 'dev-secret-rotate-me';
const MODE = process.argv[2] ?? '';

const MODES = ['unsigned', 'wrong-signature', 'sentry', 'pagerduty', 'gitlab-ci', 'cron'] as const;
type Mode = (typeof MODES)[number];

if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}
if (!(MODES as readonly string[]).includes(MODE)) {
  console.error(`usage: bun run probe.ts <${MODES.join('|')}>`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Fixtures: minimal, real-shaped provider payloads.
// ---------------------------------------------------------------------------

const FIXTURES: Record<
  Exclude<Mode, 'unsigned' | 'wrong-signature'>,
  {
    source: string;
    event: Record<string, unknown>;
    expectKind: string;
    expectSeverity: string;
    // Actions the routing skill may legitimately choose for this event.
    allowActions: string[];
  }
> = {
  sentry: {
    source: 'sentry',
    event: {
      action: 'created',
      data: {
        event: {
          title: 'TypeError: cannot read property "id" of undefined',
          level: 'fatal',
          project: 'checkout-api',
          web_url: 'https://sentry.io/organizations/acme/issues/123/',
        },
      },
    },
    expectKind: 'error.created',
    expectSeverity: 'critical',
    allowActions: ['page', 'notify'],
  },
  pagerduty: {
    source: 'pagerduty',
    event: {
      event: {
        event_type: 'incident.triggered',
        data: {
          title: 'Checkout latency SLO burn',
          urgency: 'high',
          service: { summary: 'checkout-api' },
          html_url: 'https://acme.pagerduty.com/incidents/PABC123',
        },
      },
    },
    expectKind: 'incident.triggered',
    expectSeverity: 'critical',
    allowActions: ['page', 'notify'],
  },
  'gitlab-ci': {
    source: 'gitlab-ci',
    event: {
      object_kind: 'pipeline',
      object_attributes: {
        name: 'deploy-prod',
        status: 'failed',
        url: 'https://gitlab.com/acme/checkout/-/pipelines/9001',
      },
      project: { path_with_namespace: 'acme/checkout' },
    },
    expectKind: 'pipeline.failed',
    expectSeverity: 'high',
    allowActions: ['page', 'notify'],
  },
  cron: {
    source: 'cron',
    event: {
      kind: 'cron.tick',
      title: 'Nightly dependency refresh',
      service: 'flue-snippets',
    },
    expectKind: 'cron.tick',
    expectSeverity: 'info',
    allowActions: ['log', 'notify'],
  },
};

// ---------------------------------------------------------------------------

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

// Flue 1.0 workflow: synchronous invocation is POST <base>?wait=result.
const url = `${BASE}?wait=result`;

async function post(body: unknown): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

// --- Negative gates ---------------------------------------------------------

function parseResult(text: string): Record<string, unknown> {
  const json = JSON.parse(text) as { result?: Record<string, unknown> };
  return json.result ?? {};
}

if (MODE === 'unsigned') {
  const { status, text } = await post({ source: 'generic', event: { kind: 'x' } });
  if (status !== 200) {
    console.error(`expected transport 200, got ${status}: ${text}`);
    process.exit(1);
  }
  const r = parseResult(text);
  if (r.ok !== false || r.status !== 401) {
    console.error(`expected result.ok=false status=401, got ${JSON.stringify(r)}`);
    process.exit(1);
  }
  console.log('✓ unsigned request rejected (result.ok=false, 401)');
  process.exit(0);
}

if (MODE === 'wrong-signature') {
  const { status, text } = await post({
    source: 'generic',
    event: { kind: 'x' },
    _sig: `sha256=deadbeef${'a'.repeat(56)}`,
  });
  if (status !== 200) {
    console.error(`expected transport 200, got ${status}: ${text}`);
    process.exit(1);
  }
  const r = parseResult(text);
  if (r.ok !== false || r.status !== 401) {
    console.error(`expected result.ok=false status=401, got ${JSON.stringify(r)}`);
    process.exit(1);
  }
  console.log('✓ wrong-signature request rejected (result.ok=false, 401)');
  process.exit(0);
}

// --- Positive gates (one per source) ---------------------------------------

const fx = FIXTURES[MODE as keyof typeof FIXTURES];
const rawBody = JSON.stringify(fx.event);
const _sig = await sign(SECRET, rawBody);

const { status, text } = await post({ source: fx.source, event: fx.event, _sig });
if (status !== 200) {
  console.error(`expected 200, got ${status}: ${text}`);
  process.exit(1);
}

const json = JSON.parse(text) as {
  result?: {
    ok?: unknown;
    handled?: string;
    event?: { kind?: unknown; severity?: unknown; source?: unknown };
    route?: { action?: unknown; channel?: unknown; reason?: unknown };
  };
};
console.log(JSON.stringify(json));

const result = json.result;
if (!result) {
  console.error('response missing result');
  process.exit(1);
}
if (result.ok !== true) {
  console.error(`expected result.ok=true, got ${JSON.stringify(result.ok)}`);
  process.exit(1);
}

// 2. Normalizer assertions.
const ev = result.event ?? {};
if (ev.source !== fx.source) {
  console.error(`event.source mismatch: expected ${fx.source}, got ${JSON.stringify(ev.source)}`);
  process.exit(1);
}
if (ev.kind !== fx.expectKind) {
  console.error(`event.kind mismatch: expected ${fx.expectKind}, got ${JSON.stringify(ev.kind)}`);
  process.exit(1);
}
if (ev.severity !== fx.expectSeverity) {
  console.error(
    `event.severity mismatch: expected ${fx.expectSeverity}, got ${JSON.stringify(ev.severity)}`,
  );
  process.exit(1);
}

// 3. Routing-skill structured-output assertions.
const route = result.route ?? {};
const action = route.action;
if (typeof action !== 'string' || !['page', 'notify', 'log'].includes(action)) {
  console.error(`route.action invalid: ${JSON.stringify(action)}`);
  process.exit(1);
}
if (!fx.allowActions.includes(action)) {
  console.error(
    `route.action=${action} not sensible for a ${fx.expectSeverity} ${fx.expectKind} ` +
      `(expected one of ${fx.allowActions.join('|')}) — LLM drift`,
  );
  process.exit(1);
}
if (typeof route.channel !== 'string' || route.channel.length === 0) {
  console.error('route.channel missing or empty');
  process.exit(1);
}
if (typeof route.reason !== 'string' || route.reason.length === 0) {
  console.error('route.reason missing or empty');
  process.exit(1);
}

console.log(
  `✓ ${fx.source}: kind=${ev.kind} severity=${ev.severity} → action=${action} channel=${route.channel}`,
);
console.log(`✓ reason: ${route.reason}`);
