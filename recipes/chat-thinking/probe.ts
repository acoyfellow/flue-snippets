/**
 * probe.ts, the real assertion for chat-thinking (Flue 1.0 workflow).
 *
 * Two workflow invocations with the SAME chatId. Each forwards to a
 * per-chatId Cloudflare Think DO that persists the conversation in SQLite,
 * so turn 2 must recall the unique fact from turn 1.
 *
 * Required env: AGENT_URL_BASE (deployed worker base + /workflows/chat-thinking)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const chatId = `gp-${Date.now()}`;
const url = `${BASE}?wait=result`;

async function turn(message: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { result?: { ok?: boolean; answer?: string; error?: string } };
  const r = body.result;
  if (!r || r.ok !== true || typeof r.answer !== 'string' || r.answer.length === 0) {
    console.error(`result.answer missing/empty in: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  return r.answer;
}

const t1 = await turn('My favourite colour is octarine. Reply with one word.');
console.log(`turn 1: ${t1}`);
const t2 = await turn('What did I just tell you my favourite colour was?');
console.log(`turn 2: ${t2}`);

if (!t2.toLowerCase().includes('octarine')) {
  console.error(`Think DO did not persist memory: turn 2 didn't recall "octarine" (got: ${t2})`);
  process.exit(1);
}
console.log('✓ Think DO session memory persisted across turns');
