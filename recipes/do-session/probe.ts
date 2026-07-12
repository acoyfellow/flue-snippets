/**
 * probe.ts, the real assertion for do-session (Flue 1.0 agent instance).
 *
 * Two chat turns to the SAME /agents/do-session/<userId>. Flue stores the
 * conversation in a per-DO session, so turn 2 must recall the unique fact
 * established in turn 1.
 *
 * Flue 1.0 agents are fire-and-forget: POST /agents/:name/:id returns 202
 * { streamUrl, offset, submissionId } and does NOT block on the reply. We
 * read the reply by polling the materialized conversation snapshot at
 * GET /agents/:name/:id?view=history until a new assistant message settles.
 *
 * This is the reusable "agent-instance E2E" harness; other agent recipes
 * (do-governor, chat-thinking, durable-objects) reuse the same shape.
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

interface UiPart {
  type: string;
  text?: string;
}
interface UiMessage {
  role: string;
  parts?: UiPart[];
}
interface Snapshot {
  messages?: UiMessage[];
}

function assistantTexts(snap: Snapshot): string[] {
  return (snap.messages ?? [])
    .filter((m) => m.role === 'assistant')
    .map((m) =>
      (m.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join(''),
    )
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

async function readSnapshot(): Promise<Snapshot> {
  const res = await fetch(`${url}?view=history`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`history HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as Snapshot;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function turn(message: string, priorCount: number): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (res.status !== 202 && res.status !== 200) {
    console.error(`turn POST expected 202, got ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    let snap: Snapshot;
    try {
      snap = await readSnapshot();
    } catch {
      await sleep(2000);
      continue;
    }
    const texts = assistantTexts(snap);
    if (texts.length > priorCount) return texts[texts.length - 1] ?? '';
    await sleep(2000);
  }
  console.error('timed out waiting for assistant reply');
  process.exit(1);
}

const t1 = await turn('My favourite colour is octarine. Acknowledge in one word.', 0);
console.log(`turn 1: ${t1}`);
const t2 = await turn('What did I just tell you my favourite colour was?', 1);
console.log(`turn 2: ${t2}`);

if (!t2.toLowerCase().includes('octarine')) {
  console.error(`session did not persist memory: turn 2 didn't recall "octarine" (got: ${t2})`);
  process.exit(1);
}
console.log('✓ session memory persisted across turns');
