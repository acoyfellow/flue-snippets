/**
 * probe.ts, the real assertion for chat-thinking.
 *
 * Two POSTs to the same chatId path. The Flue agent forwards each call
 * to a per-chat Think DO via RPC; Think persists the conversation in
 * SQLite, so the second turn should still recall the unique fact
 * established in the first turn.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/chat-thinking)
 *
 * Response shape: the Flue agent returns `{ answer: string }` and Flue
 * wraps it as `{ result: { answer: string } }` on the webhook response.
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const chatId = `gp-${Date.now()}`;
const url = `${BASE}/${chatId}`;

async function turn(message: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { result?: { answer?: string } };
  const answer = body.result?.answer;
  if (typeof answer !== 'string' || answer.length === 0) {
    console.error(`result.answer missing or empty in: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  return answer;
}

const t1 = await turn('My favourite colour is octarine. Reply with one word.');
console.log(`turn 1: ${t1}`);

const t2 = await turn('What did I just tell you my favourite colour was?');
console.log(`turn 2: ${t2}`);

if (!t2.toLowerCase().includes('octarine')) {
  console.error(`Think DO did not persist memory: turn 2 didn't recall "octarine"`);
  process.exit(1);
}
console.log('✓ Think chat memory persisted across turns');
