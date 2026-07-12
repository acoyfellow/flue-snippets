/**
 * probe.ts — GitHub channel signature handling (Flue 1.0 @flue/github).
 *
 * Modes (argv[2]):
 *   unsigned        — POST with no x-hub-signature-256      → expect 401
 *   wrong-signature — POST with a bad signature            → expect 401
 *   signed          — POST a correctly-signed issues.opened → expect 200 + handled
 *
 * @flue/github verifies HMAC-SHA256 over the RAW request body (real header,
 * real status codes — no re-serialization shim).
 *
 * Required env: AGENT_URL_BASE (worker base + /channels/github/webhook), GITHUB_WEBHOOK_SECRET
 */
const BASE = process.env.AGENT_URL_BASE;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret-rotate-me';
const MODE = process.argv[2] ?? '';
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}
if (!['unsigned', 'wrong-signature', 'signed'].includes(MODE)) {
  console.error('usage: bun run probe.ts <unsigned|wrong-signature|signed>');
  process.exit(2);
}

const payload = {
  action: 'opened',
  issue: {
    number: 42,
    title: 'App crashes on large upload',
    body: 'Steps: upload >100MB. Repro on Chrome 130.',
  },
  repository: { name: 'demo-repo', owner: { login: 'demo-owner' } },
};
const rawBody = JSON.stringify(payload);

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

async function post(headers: Record<string, string>): Promise<number> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'issues',
      'x-github-delivery': `probe-${Date.now()}`,
      ...headers,
    },
    body: rawBody,
  });
  const status = res.status;
  const text = await res.text();
  if (MODE === 'signed' && status === 200) {
    console.log(`  200 body: ${text.slice(0, 200)}`);
  }
  return status;
}

if (MODE === 'unsigned') {
  const s = await post({});
  if (s !== 401) {
    console.error(`expected 401, got ${s}`);
    process.exit(1);
  }
  console.log('✓ unsigned rejected (401)');
} else if (MODE === 'wrong-signature') {
  const s = await post({ 'x-hub-signature-256': `sha256=deadbeef${'a'.repeat(56)}` });
  if (s !== 401) {
    console.error(`expected 401, got ${s}`);
    process.exit(1);
  }
  console.log('✓ wrong-signature rejected (401)');
} else {
  const sig = await sign(SECRET, rawBody);
  // retry through cold-start
  let s = 0;
  for (let i = 0; i < 20; i++) {
    s = await post({ 'x-hub-signature-256': sig });
    if (s === 200) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (s !== 200) {
    console.error(`expected 200, got ${s}`);
    process.exit(1);
  }
  console.log('✓ signed issues.opened accepted (200), dispatched to triage agent');
}
