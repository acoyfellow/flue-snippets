const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

interface UiPart {
  type: string;
  text?: string;
}

interface Snapshot {
  messages?: Array<{ role: string; parts?: UiPart[] }>;
}

const url = `${base}/probe-${Date.now()}`;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assistantParts(snapshot: Snapshot) {
  return (snapshot.messages ?? [])
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts ?? []);
}

let admitted = false;
for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ kind: 'user', body: 'What is 17 multiplied by 19? Explain briefly.' }),
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
    const parts = assistantParts((await response.json()) as Snapshot);
    const hasText = parts.some((part) => part.type === 'text' && (part.text ?? '').length > 0);
    const hasReasoning = parts.some((part) => part.type === 'reasoning');
    if (hasText && hasReasoning) {
      console.log('✓ conversation snapshot includes both reasoning and text parts');
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for reasoning and text parts');
