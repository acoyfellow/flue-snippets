/**
 * probe-mid.ts, call the lab-checkpoint agent at a non-checkpoint
 * cycle (cycle=1 with every=3 → next cycle becomes 2, NOT a checkpoint
 * boundary) and assert the response has NO `receipt` field.
 *
 * Required env:
 *   AGENT_URL, full POST target
 *
 * Exits 0 only if the response has a result with no receipt field.
 */

const URL = process.env.AGENT_URL;
if (!URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const res = await fetch(URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'mid', cycle: 1, every: 3 }),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const body = (await res.json()) as { result?: { receipt?: unknown } };
console.log(JSON.stringify(body));
if (body.result?.receipt) {
  console.error(`unexpected receipt at non-checkpoint cycle: ${body.result.receipt}`);
  process.exit(1);
}
console.log('✓ no receipt at mid-cycle, as expected');
