/** Runtime assertion for braintrust-ai-gateway. Required env: AGENT_URL. */

export {};

const URL = process.env.AGENT_URL;
const EXPECTED_GATEWAY = process.env.BRAINTRUST_GATEWAY_URL ?? 'https://gateway.braintrust.dev';
if (!URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const response = await fetch(URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'Reply with one short greeting.' }),
});

if (!response.ok) {
  console.error(`expected 200, got ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}

const body = (await response.json()) as {
  result?: { answer?: string; gateway?: string; model?: string; loggedSpan?: boolean };
};
console.log(JSON.stringify(body));

if (typeof body.result?.answer !== 'string' || body.result.answer.length === 0) {
  console.error('result.answer missing or empty');
  process.exit(1);
}
if (body.result.gateway !== EXPECTED_GATEWAY) {
  console.error(`unexpected gateway echo: ${body.result.gateway}`);
  process.exit(1);
}
if (body.result.loggedSpan !== true) {
  console.error('gateway did not return x-bt-span-id after x-bt-parent logging request');
  process.exit(1);
}

console.log(
  `✓ response from Braintrust gateway (${body.result.model}); logged span id was returned`,
);
