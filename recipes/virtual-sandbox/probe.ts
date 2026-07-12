/**
 * probe.ts, the real assertion for virtual-sandbox (Flue 1.0 workflow).
 *
 * One invocation with a question whose answer only exists in the seeded R2
 * docs. If the sandbox seeding + grep worked, the answer contains "octarine".
 *
 * Required env: AGENT_URL_BASE (deployed worker base + /workflows/virtual-sandbox)
 */
const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const res = await fetch(`${BASE}?wait=result`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'What colour is magic?' }),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const body = (await res.json()) as { result?: { answer?: string } };
const text = body.result?.answer;
if (typeof text !== 'string' || text.length === 0) {
  console.error(`result.answer missing/empty in: ${JSON.stringify(body)}`);
  process.exit(1);
}
console.log(`answer: ${text}`);
if (!text.toLowerCase().includes('octarine')) {
  console.error(`agent did not grep the seeded doc: expected "octarine", got: ${text}`);
  process.exit(1);
}
console.log('✓ agent grepped the R2-seeded doc from the virtual sandbox');
