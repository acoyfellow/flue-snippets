/**
 * probe.ts — proves Durable Object per-instance routing (Flue 1.0 agent).
 *
 * Establish a fact in instance A (two turns, same id): A recalls it.
 * A DIFFERENT instance B does NOT know the fact — separate DO, separate history.
 *
 * Agents are fire-and-forget (POST -> 202); replies read from
 * GET /agents/durable-objects/<id>?view=history.
 *
 * Required env: AGENT_URL_BASE (deployed worker base + /agents/durable-objects)
 */
const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function assistantTexts(s: Snapshot): string[] {
  return (s.messages ?? [])
    .filter((m) => m.role === 'assistant')
    .map((m) =>
      (m.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('')
        .trim(),
    )
    .filter((t) => t.length > 0);
}
async function history(id: string): Promise<Snapshot> {
  const res = await fetch(`${BASE}/${id}?view=history`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  return (await res.json()) as Snapshot;
}
async function turn(id: string, message: string, priorCount: number): Promise<string> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (res.status !== 202 && res.status !== 200) {
    console.error(`POST ${id} expected 202, got ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    let snap: Snapshot;
    try {
      snap = await history(id);
    } catch {
      await sleep(2000);
      continue;
    }
    const t = assistantTexts(snap);
    if (t.length > priorCount) return t[t.length - 1] ?? '';
    await sleep(2000);
  }
  console.error(`timed out waiting for reply from ${id}`);
  process.exit(1);
}

const a = `alice-${Date.now()}`;
const b = `bob-${Date.now()}`;

await turn(a, 'My favourite colour is octarine. Acknowledge in one word.', 0);
const a2 = await turn(a, 'What is my favourite colour?', 1);
console.log(`instance A recall: ${a2}`);
if (!a2.toLowerCase().includes('octarine')) {
  console.error('same-id instance did not recall the fact');
  process.exit(1);
}

const b1 = await turn(b, 'What is my favourite colour? If you do not know, say "unknown".', 0);
console.log(`instance B (fresh): ${b1}`);
if (b1.toLowerCase().includes('octarine')) {
  console.error('different-id instance leaked state — DO isolation broken');
  process.exit(1);
}

console.log('✓ same id = same DO (recall); different id = isolated DO (no leak)');
