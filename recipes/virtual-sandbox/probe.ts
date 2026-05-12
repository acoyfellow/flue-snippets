/**
 * probe.ts — the real assertion for virtual-sandbox.
 *
 * One POST to the agent with a question whose answer only exists in the
 * seeded R2 doc `/workspace/docs/colours.md`. If the agent can grep the
 * mounted R2 bucket, it will return "octarine"; if the sandbox mount
 * failed, the model will hallucinate or refuse.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/virtual-sandbox)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const url = `${BASE}/probe-${Date.now()}`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'what colour is magic?' }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const body = (await res.json()) as { result?: { answer?: { text?: string } } };
const text = body.result?.answer?.text;
if (typeof text !== 'string') {
  console.error(`result.answer.text missing in: ${JSON.stringify(body)}`);
  process.exit(1);
}

console.log(`answer: ${text}`);

if (!text.toLowerCase().includes('octarine')) {
  console.error(
    `agent did not grep the seeded doc: expected "octarine" in answer, got: ${text}`,
  );
  process.exit(1);
}
console.log('✓ agent grepped /workspace/docs and surfaced the seeded fact');
