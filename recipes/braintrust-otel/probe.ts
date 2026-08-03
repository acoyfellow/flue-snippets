const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/probe-${Date.now()}`;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

let admitted = false;
for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ kind: 'user', body: 'Reply with one short greeting.' }),
  });
  if (response.status === 202) {
    admitted = true;
    break;
  }
  await sleep(4000);
}
if (!admitted) throw new Error('agent did not admit the request with HTTP 202');

for (let attempt = 0; attempt < 60; attempt += 1) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': API_KEY } });
  if (response.ok) {
    const snapshot = JSON.stringify(await response.json()).replaceAll('\\', '');
    if (snapshot.includes('"otelFlushCompleted":true')) {
      console.log('✓ Workers AI answered and OTel flush completed');
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for the Braintrust OTel tool result');
