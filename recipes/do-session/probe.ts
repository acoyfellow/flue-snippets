/**
 * probe.ts, the real assertion for do-session.
 *
 * Two POSTs to the same userId path. The Flue agent stores conversation
 * history in a per-DO session, so the second turn should still be able
 * to recall the unique fact established in the first turn.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/do-session)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const userId = `gp-${Date.now()}`;
const url = `${BASE}/${userId}`;

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
  const body = (await res.json()) as { result?: { answer?: { text?: string } } };
  const text = body.result?.answer?.text;
  if (typeof text !== 'string') {
    console.error(`result.answer.text missing in: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  return text;
}

const t1 = await turn('My favourite colour is octarine. Reply with one word.');
console.log(`turn 1: ${t1}`);

const t2 = await turn('What did I just tell you my favourite colour was?');
console.log(`turn 2: ${t2}`);

if (!t2.toLowerCase().includes('octarine')) {
  console.error(`session did not persist memory: turn 2 didn't recall "octarine"`);
  process.exit(1);
}
console.log('✓ session memory persisted across turns');
