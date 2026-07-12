/** Cheap live preflight before uploading an evaluation. Required env: AGENT_URL. */

export {};

const URL = process.env.AGENT_URL;
if (!URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const response = await fetch(URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'Reply with one word: observability.' }),
});
if (!response.ok) {
  console.error(`expected 200, got ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}
const body = (await response.json()) as { result?: { answer?: string; provider?: string } };
console.log(JSON.stringify(body));
if (!body.result?.answer || body.result.provider !== 'workers-ai') {
  console.error('expected a non-empty Workers AI result');
  process.exit(1);
}
console.log('✓ evaluation target responds through Workers AI');
