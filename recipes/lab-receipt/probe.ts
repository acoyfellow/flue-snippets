/**
 * probe.ts, the real assertion for lab-receipt.
 *
 * POST a prompt, expect:
 *   - HTTP 200
 *   - body.result.answer.text is a non-empty string
 *   - body.result.receipt is a https://lab... URL that itself returns 200
 *
 * Pure fetch + JSON. No bash heredocs, no python one-liners, model
 * responses with literal newlines breaks both.
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
  body: JSON.stringify({ message: 'hello from gateproof' }),
});

if (!res.ok) {
  console.error(`expected 200, got ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const body = (await res.json()) as {
  result?: { answer?: { text?: string }; receipt?: string };
};
const text = body.result?.answer?.text;
const receipt = body.result?.receipt;

console.log(JSON.stringify(body));

if (typeof text !== 'string' || text.length === 0) {
  console.error('result.answer.text missing or empty');
  process.exit(1);
}
if (!receipt || !/^https:\/\/[^/]+\/results\/[^/]+$/.test(receipt)) {
  console.error(`result.receipt URL malformed: ${receipt}`);
  process.exit(1);
}

// Verify the lab actually persisted the receipt
const labRes = await fetch(`${receipt}.json`);
if (!labRes.ok) {
  console.error(`lab did not serve receipt (HTTP ${labRes.status} from ${receipt}.json)`);
  process.exit(1);
}

console.log(`✓ receipt: ${receipt}`);
