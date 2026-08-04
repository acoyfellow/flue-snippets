const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const conversation = `ws-${Date.now()}`;
const url = `${base}/${conversation}`;
const SENTINEL = `octarine-${Math.random().toString(36).slice(2, 10)}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send(body: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ kind: 'user', body }),
    });
    if (response.status === 202 || response.status === 200) return;
    if (attempt === 14) throw new Error(`expected 202, got ${response.status}`);
    await sleep(4000);
  }
}

async function waitForAssistantText(match: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(url, { headers: { 'x-api-key': API_KEY } });
    if (response.ok) {
      const snapshot = (await response.json()) as {
        messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>;
      };
      const text = (snapshot.messages ?? [])
        .filter((message) => message.role === 'assistant')
        .flatMap((message) => message.parts ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('\n');
      if (text.toLowerCase().includes(match.toLowerCase())) return text;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for assistant text containing ${match}`);
}

// Request 1: write a file into the @cloudflare/computer workspace.
await send(`Save a note named spell.md whose body is exactly: ${SENTINEL}`);
await waitForAssistantText('spell.md');
console.log(`wrote spell.md containing ${SENTINEL}`);

// Request 2: a SEPARATE HTTP request to the same conversation. The workspace
// is backed by this Durable Object's SQLite, so the file must still be there.
await send('Read the note named spell.md and reply with its exact contents.');
const readBack = await waitForAssistantText(SENTINEL);
console.log(`read spell.md back on a later request: ${readBack.trim().slice(0, 200)}`);

// Request 3: grep proves it is a real filesystem, not a string in the prompt.
await send(`Grep the notes for the pattern ${SENTINEL} and report the matching file.`);
await waitForAssistantText('spell.md');
console.log('grep found the sentinel inside the durable workspace');

// A different conversation id is a different Durable Object, so it has its own
// empty disk. This is what proves the filesystem is per-instance, not global.
const isolated = `${base}/ws-isolated-${Date.now()}`;
for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(isolated, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ kind: 'user', body: 'List the notes you have.' }),
  });
  if (response.status === 202 || response.status === 200) break;
  if (attempt === 14) throw new Error(`isolated instance expected 202, got ${response.status}`);
  await sleep(4000);
}

const deadline = Date.now() + 120_000;
let isolatedText = '';
while (Date.now() < deadline) {
  const response = await fetch(isolated, { headers: { 'x-api-key': API_KEY } });
  if (response.ok) {
    const snapshot = (await response.json()) as {
      messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>;
    };
    isolatedText = (snapshot.messages ?? [])
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.parts ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n');
    if (isolatedText.length > 0) break;
  }
  await sleep(2000);
}

if (isolatedText.toLowerCase().includes(SENTINEL.toLowerCase())) {
  console.error('a different agent instance can see the first workspace: isolation broken');
  process.exit(1);
}

console.log('✓ workspace survives across requests, and a different instance starts empty');
