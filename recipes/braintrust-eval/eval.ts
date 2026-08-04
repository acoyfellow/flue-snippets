import { Eval } from 'braintrust';

const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const API_KEY = process.env.SNIPPET_API_KEY ?? '';

interface UiPart {
  type: string;
  text?: string;
}

interface Snapshot {
  messages?: Array<{ role: string; parts?: UiPart[] }>;
}

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

async function answer(message: string) {
  const url = `${base}/eval-${crypto.randomUUID()}`;
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
  if (!admitted) throw new Error('agent did not admit the evaluation request with HTTP 202');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': API_KEY } });
    if (response.ok) {
      const texts = assistantTexts((await response.json()) as Snapshot);
      if (texts.length > 0) return { answer: texts.at(-1) ?? '' };
    }
    await sleep(2000);
  }
  throw new Error('timed out waiting for the evaluation response');
}

Eval('flue-snippets', {
  experimentName: 'braintrust-eval / deployed Workers AI agent',
  data: [
    {
      input: { message: 'Reply with exactly the word: observability' },
      expected: 'observability',
    },
    {
      input: { message: 'Reply with exactly the word: trace' },
      expected: 'trace',
    },
  ],
  task: async (input) => answer(input.message),
  scores: [
    ({ output, expected }) => ({
      name: 'contains_requested_word',
      score: output.answer.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0,
    }),
  ],
  metadata: { target: 'cloudflare-worker', provider: 'workers-ai', recipe: 'braintrust-eval' },
});
