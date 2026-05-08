/**
 * probe.ts — assert gateway-lab returns a model answer (via gateway)
 * AND emits a Lab receipt that lab.coey.dev actually persists.
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
  body: JSON.stringify({ message: 'hi from gateproof, gateway+lab' }),
});

if (!res.ok) {
  console.error(`expected 200, got ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const body = (await res.json()) as {
  result?: { answer?: string; receipt?: string; gateway?: string };
};
console.log(JSON.stringify(body));

const answer = body.result?.answer;
const receipt = body.result?.receipt;
const gateway = body.result?.gateway;

if (typeof answer !== 'string' || answer.length === 0) {
  console.error('result.answer missing or empty');
  process.exit(1);
}
if (!receipt || !/^https:\/\/[^/]+\/results\/[^/]+$/.test(receipt)) {
  console.error(`result.receipt URL malformed: ${receipt}`);
  process.exit(1);
}
if (typeof gateway !== 'string' || gateway.length === 0) {
  console.error('result.gateway missing — agent should echo the gateway it used');
  process.exit(1);
}

const labRes = await fetch(`${receipt}.json`);
if (!labRes.ok) {
  console.error(`lab did not serve the receipt (HTTP ${labRes.status} from ${receipt}.json)`);
  process.exit(1);
}

console.log(`✓ via gateway "${gateway}"; receipt: ${receipt}`);
