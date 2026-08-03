const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
const secret = process.env.EVENT_HMAC_SECRET ?? 'dev-secret-rotate-me';
const mode = process.argv[2];
if (!base) throw new Error('AGENT_URL_BASE is required');

const fixtures: Record<string, { source: string; event: Record<string, unknown>; expected: string[] }> = {
  sentry: {
    source: 'sentry',
    event: { action: 'created', data: { event: { title: 'fatal error', level: 'fatal' } } },
    expected: ['error.created', 'critical', 'page'],
  },
  pagerduty: {
    source: 'pagerduty',
    event: { event: { event_type: 'incident.triggered', data: { title: 'SLO burn', urgency: 'high' } } },
    expected: ['incident.triggered', 'critical', 'page'],
  },
  'gitlab-ci': {
    source: 'gitlab-ci',
    event: { object_kind: 'pipeline', object_attributes: { name: 'deploy', status: 'failed' } },
    expected: ['pipeline.failed', 'high', 'notify'],
  },
  cron: {
    source: 'cron',
    event: { kind: 'cron.tick', title: 'Nightly refresh' },
    expected: ['cron.tick', 'info', 'log'],
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signature(body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `sha256=${Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

if (mode === 'unsigned' || mode === 'wrong-signature') {
  const response = await fetch(`${base}/events/generic/${Date.now()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-event-signature': mode === 'wrong-signature' ? 'sha256=deadbeef' : '' },
    body: JSON.stringify({ kind: 'x' }),
  });
  if (response.status !== 401) throw new Error(`expected 401, got ${response.status}`);
  console.log(`${mode} rejected`);
  process.exit(0);
}

const fixture = fixtures[mode ?? ''];
if (!fixture) throw new Error('expected a supported event mode');
const id = `${fixture.source}-${Date.now()}`;
const raw = JSON.stringify(fixture.event);
let admitted = false;
for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(`${base}/events/${fixture.source}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-event-signature': await signature(raw) },
    body: raw,
  });
  if (response.status === 202) {
    admitted = true;
    break;
  }
  await sleep(4000);
}
if (!admitted) throw new Error('event was not admitted');

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const response = await fetch(`${base}/agents/event-trigger/${id}`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (response.ok) {
    const snapshot = (await response.json()) as { messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> };
    const text = (snapshot.messages ?? []).filter((message) => message.role === 'assistant').flatMap((message) => message.parts ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n');
    if (fixture.expected.every((value) => text.includes(value))) {
      console.log(`${fixture.source} routed: ${text}`);
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error(`timed out waiting for ${fixture.source} routing response`);
