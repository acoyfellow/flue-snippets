/** Runtime assertion for braintrust-trace. Required env: AGENT_URL. */

export {};

const URL = process.env.AGENT_URL;
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
  result?: { answer?: string; project?: string; traceFlushCompleted?: boolean };
};
console.log(JSON.stringify(body));

if (typeof body.result?.answer !== 'string' || body.result.answer.length === 0) {
  console.error('result.answer missing or empty');
  process.exit(1);
}
if (body.result.traceFlushCompleted !== true || !body.result.project) {
  console.error('agent did not report completion of its Braintrust flush path');
  process.exit(1);
}

console.log(`✓ Workers AI answered and Braintrust flush completed for "${body.result.project}"`);
