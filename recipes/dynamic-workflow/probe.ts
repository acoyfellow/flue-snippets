/**
 * probe.ts, the real assertion for dynamic-workflow (Flue 1.0).
 *
 * Enqueue three tasks to the same runId via the Flue workflow front door,
 * poll status until the co-hosted Cloudflare Workflow drains the DO queue,
 * and assert all three completed in enqueue order — proving the runtime-
 * materialized step.do() loop ran.
 *
 * Required env: AGENT_URL_BASE (deployed worker base + /workflows/dynamic-workflow)
 */
const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const runId = `gp-${Date.now()}`;
const url = `${BASE}?wait=result`;

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Retry transient non-200s (the first enqueue can race the Cloudflare
  // Workflow binding's cold start).
  let lastText = '';
  for (let i = 0; i < 8; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId, ...body }),
    });
    if (res.ok) {
      const b = (await res.json()) as { result?: Record<string, unknown> };
      return b.result ?? {};
    }
    lastText = await res.text();
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error(`call failed after retries: ${lastText}`);
  process.exit(1);
}

const TASKS = [
  { kind: 'echo', value: 'alpha' },
  { kind: 'echo', value: 'beta' },
  { kind: 'echo', value: 'gamma' },
];

console.log(`runId: ${runId}`);
for (const task of TASKS) {
  const r = await call({ action: 'enqueue', task });
  console.log(`  enqueued ${JSON.stringify(task)} → queueSize=${r.queueSize} started=${r.started}`);
}

const DEADLINE = Date.now() + 120_000;
let last: Record<string, unknown> | null = null;
while (Date.now() < DEADLINE) {
  const r = await call({ action: 'status' });
  last = r;
  const wf = (r.workflow as { status?: string } | null) ?? null;
  const completed = (r.completed as unknown[] | undefined) ?? [];
  console.log(
    `  status: workflow=${wf?.status ?? 'pending'} completed=${completed.length} queueSize=${r.queueSize}`,
  );
  if (completed.length >= TASKS.length && (wf?.status === 'complete' || wf?.status === 'errored'))
    break;
  await new Promise((r) => setTimeout(r, 2000));
}

if (!last) {
  console.error('no status response');
  process.exit(1);
}
const completed = (last.completed as Array<{ value?: unknown }>) ?? [];
const values = completed.map((c) => c.value);
console.log(`final completed values: ${JSON.stringify(values)}`);
const expected = TASKS.map((t) => t.value);
if (values.length !== expected.length) {
  console.error(`expected ${expected.length} completions, got ${values.length}`);
  process.exit(1);
}
for (let i = 0; i < expected.length; i++) {
  if (values[i] !== expected[i]) {
    console.error(`out-of-order: [${i}] expected ${expected[i]} got ${values[i]}`);
    process.exit(1);
  }
}
const wf = (last.workflow as { status?: string } | null) ?? null;
if (wf?.status !== 'complete') {
  console.error(`workflow not complete; final=${wf?.status}`);
  process.exit(1);
}
console.log('✓ dynamic workflow drained all 3 tasks in order, instance complete');
