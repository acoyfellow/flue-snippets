/**
 * probe.ts, three modes asserting webhook signature handling.
 *
 * Modes (selected by argv[2]):
 *   unsigned        , POST with no x-hub-signature-256 header → expect 401
 *   wrong-signature , POST with sha256=deadbeef…             → expect 401
 *   signed          , POST with correct HMAC                  → expect 200 + handled:issues.opened
 *
 * The "header" is forwarded inside payload._headers because Flue's
 * FlueContext doesn't currently surface the raw request headers in a
 * straightforward way. See the agent's TODO for why.
 *
 * Required env: AGENT_URL_BASE, GITHUB_WEBHOOK_SECRET
 */

const BASE = process.env.AGENT_URL_BASE;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret-rotate-me';
const MODE = (process.argv[2] ?? '') as 'unsigned' | 'wrong-signature' | 'signed';

if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}
if (!['unsigned', 'wrong-signature', 'signed'].includes(MODE)) {
  console.error(`usage: bun run probe.ts <unsigned|wrong-signature|signed>`);
  process.exit(2);
}

const issuePayload = {
  action: 'opened',
  issue: {
    number: 42,
    title: 'App crashes when uploading large files',
    body: [
      '## Steps to reproduce',
      '1. Open the upload modal',
      '2. Pick any file > 100MB',
      '3. Click upload',
      '',
      '## Expected',
      'Upload completes',
      '',
      '## Actual',
      'App crashes, browser tab freezes for 30s then shows blank page.',
      'Reproducible on Chrome 130 and Firefox 131 on macOS 15.',
    ].join('\n'),
  },
  repository: {
    name: 'demo-repo',
    owner: { login: 'demo-owner' },
  },
};

const rawBody = JSON.stringify(issuePayload);

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

function buildPayload(headers: { signature?: string; event?: string }) {
  return { ...issuePayload, _headers: headers };
}

const url = `${BASE}/probe-${MODE}-${Date.now()}`;

async function post(body: unknown): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

if (MODE === 'unsigned') {
  const { status, text } = await post(buildPayload({ event: 'issues' }));
  if (status !== 401) {
    console.error(`expected 401, got ${status}: ${text}`);
    process.exit(1);
  }
  console.log('✓ unsigned request rejected (401)');
} else if (MODE === 'wrong-signature') {
  const { status, text } = await post(
    buildPayload({ event: 'issues', signature: 'sha256=deadbeef' + 'a'.repeat(56) }),
  );
  if (status !== 401) {
    console.error(`expected 401, got ${status}: ${text}`);
    process.exit(1);
  }
  console.log('✓ wrong-signature request rejected (401)');
} else {
  const signature = await sign(SECRET, rawBody);
  const { status, text } = await post(buildPayload({ event: 'issues', signature }));
  if (status !== 200) {
    console.error(`expected 200, got ${status}: ${text}`);
    process.exit(1);
  }
  if (!text.includes('"handled":"issues.opened"')) {
    console.error(`response missing handled marker: ${text}`);
    process.exit(1);
  }
  console.log('✓ signed request accepted and triage handled');
}
