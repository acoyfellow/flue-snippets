/**
 * probe.ts, assert ai-gateway returns a real model answer routed
 * through the Cloudflare AI Gateway.
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
  body: JSON.stringify({ message: 'hi from gateproof' }),
});

if (!res.ok) {
  console.error(`expected 200, got ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const body = (await res.json()) as { result?: { answer?: string; gateway?: string } };
console.log(JSON.stringify(body));

const answer = body.result?.answer;
const gateway = body.result?.gateway;

if (typeof answer !== 'string' || answer.length === 0) {
  console.error('result.answer missing or empty');
  process.exit(1);
}
if (typeof gateway !== 'string' || gateway.length === 0) {
  console.error('result.gateway missing, agent should echo the gateway it used');
  process.exit(1);
}

console.log(`✓ routed through AI Gateway "${gateway}"`);
