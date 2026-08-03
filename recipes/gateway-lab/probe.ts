const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/gateway-${Date.now()}`;
const message = JSON.stringify({ message: 'hi from gateproof, gateway and lab' });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let admitted = false;
for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify({ kind: 'user', body: message }) });
  if (response.status === 202 || response.status === 200) {
    admitted = true;
    break;
  }
  await sleep(4000);
}
if (!admitted) throw new Error('agent admission failed');

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const response = await fetch(url);
  if (response.ok) {
    const snapshot = (await response.json()) as { messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> };
    const text = (snapshot.messages ?? []).filter((message) => message.role === 'assistant').flatMap((message) => message.parts ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n');
    const receipt = text.match(/https:\/\/[^\s"}]+\/results\/[^\s"}]+/)?.[0];
    if (receipt) {
      const labResponse = await fetch(`${receipt}.json`);
      if (!labResponse.ok) throw new Error(`receipt did not resolve: ${labResponse.status}`);
      console.log(`gateway receipt: ${receipt}`);
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for a gateway receipt');
