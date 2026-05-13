/**
 * probe-first.ts, assert the FIRST call to lab-checkpoint persists a receipt.
 *
 * cycle starts at 0, becomes 1 → checkpoint condition (cycle === 1) is
 * true → response should include a receipt URL that lab.coey.dev serves.
 *
 * Required env: AGENT_URL
 */

const URL = process.env.AGENT_URL;
if (!URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const res = await fetch(URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'checkpoint test' }),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const body = (await res.json()) as { result?: { receipt?: string } };
console.log(JSON.stringify(body));

const receipt = body.result?.receipt;
if (!receipt || !/^https:\/\/[^/]+\/results\/[^/]+$/.test(receipt)) {
  console.error(`first call did not return a valid receipt URL: ${receipt}`);
  process.exit(1);
}

const labRes = await fetch(`${receipt}.json`);
if (!labRes.ok) {
  console.error(`lab did not serve the receipt (HTTP ${labRes.status} from ${receipt}.json)`);
  process.exit(1);
}
console.log(`✓ first-cycle receipt persisted: ${receipt}`);
