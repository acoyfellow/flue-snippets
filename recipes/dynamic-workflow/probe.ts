const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

interface Part { type: string; text?: string }
interface Message { role: string; parts?: Part[] }
interface Snapshot { messages?: Message[] }

const id = `dynamic-${Date.now()}`;
const url = `${base}/${id}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assistantText(snapshot: Snapshot) {
  return (snapshot.messages ?? [])
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
}

async function admit(body: string) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ kind: 'user', body }),
    });
    lastStatus = response.status;
    if (lastStatus === 202 || lastStatus === 200) return;
    await sleep(4000);
  }
  throw new Error(`expected admission 202, got ${lastStatus}`);
}

async function waitFor(expected: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const response = await fetch(url);
    if (response.ok) {
      const text = assistantText((await response.json()) as Snapshot);
      if (text.includes(expected)) return text;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${expected}`);
}

for (const value of ['alpha', 'beta', 'gamma']) {
  await admit(JSON.stringify({ runId: id, task: { kind: 'echo', value } }));
  await waitFor(value);
}

await admit(JSON.stringify({ runId: id, action: 'status' }));
const result = await waitFor('gamma');
for (const value of ['alpha', 'beta', 'gamma']) {
  if (!result.includes(value)) throw new Error(`missing completed value: ${value}`);
}
console.log('dynamic task orchestration preserved all three values');
