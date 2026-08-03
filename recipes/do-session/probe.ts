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

function assistantTexts(snapshot: Snapshot) {
  return (snapshot.messages ?? [])
    .filter((message) => message.role === 'assistant')
    .map((message) =>
      (message.parts ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('')
        .trim(),
    )
    .filter(Boolean);
}

async function turn(message: string, priorCount: number) {
  let admitted = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ kind: 'user', body: message }),
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
      const texts = assistantTexts((await response.json()) as Snapshot);
      if (texts.length > priorCount) return texts.at(-1) ?? '';
    }
    await sleep(2000);
  }
  throw new Error('timed out waiting for an assistant reply');
}

await turn('My favourite colour is octarine. Acknowledge in one word.', 0);
const recalled = await turn('What did I just tell you my favourite colour was?', 1);
if (!recalled.toLowerCase().includes('octarine')) {
  throw new Error(`session did not persist memory: ${recalled}`);
}
console.log('✓ session memory persisted across turns');
