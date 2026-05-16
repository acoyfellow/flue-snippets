/**
 * probe.ts, the real assertion for dynamic-workflow.
 *
 * What it proves:
 *
 *   1. POSTing three distinct tasks to the same runId enqueues into
 *      the same per-run DO queue.
 *   2. The first POST starts a Cloudflare Workflow instance; the
 *      subsequent POSTs reuse it (idempotent ensure-start).
 *   3. The Workflow's tick loop drains the DO queue, executing each
 *      task inside its own `step.do(\`tick-N\`, …)` — i.e. the set of
 *      steps is materialized at runtime from queue contents, not
 *      declared statically.
 *   4. All three tasks complete, in the order they were enqueued.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/dynamic-workflow)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const runId = `gp-${Date.now()}`;
const url = `${BASE}/${runId}`;

async function post(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body_ = (await res.json()) as { result?: Record<string, unknown> };
  return body_.result ?? {};
}

const TASKS = [
  { kind: 'echo', value: 'alpha' },
  { kind: 'echo', value: 'beta' },
  { kind: 'echo', value: 'gamma' },
];

console.log(`runId: ${runId}`);

for (const task of TASKS) {
  const r = await post({ action: 'enqueue', task });
  console.log(`  enqueued ${JSON.stringify(task)} → queueSize=${r.queueSize} started=${r.started}`);
}

// Poll status until the workflow reports complete (or we time out).
// The workflow can stop in two ways: it sees three idle ticks (~6s of
// no work) and exits cleanly, or it hits MAX_TICKS (60).
const DEADLINE = Date.now() + 120_000; // 2 minutes
let lastStatus: Record<string, unknown> | null = null;

while (Date.now() < DEADLINE) {
  const r = await post({ action: 'status' });
  lastStatus = r;
  const wf = (r.workflow as { status?: string } | null) ?? null;
  const completed = (r.completed as unknown[] | undefined) ?? [];
  console.log(
    `  status: workflow=${wf?.status ?? 'pending'} completed=${completed.length} queueSize=${r.queueSize}`,
  );

  if (completed.length >= TASKS.length && (wf?.status === 'complete' || wf?.status === 'errored')) {
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

if (!lastStatus) {
  console.error('no status response received');
  process.exit(1);
}

const completed = (lastStatus.completed as Array<{ value?: unknown; tick?: number }>) ?? [];
const values = completed.map((c) => c.value);
console.log(`final completed values: ${JSON.stringify(values)}`);

const expected = TASKS.map((t) => t.value);
if (values.length !== expected.length) {
  console.error(`expected ${expected.length} completions, got ${values.length}`);
  console.error(`full status: ${JSON.stringify(lastStatus, null, 2)}`);
  process.exit(1);
}

for (let i = 0; i < expected.length; i++) {
  if (values[i] !== expected[i]) {
    console.error(`out-of-order: expected[${i}]=${expected[i]} got=${values[i]}`);
    process.exit(1);
  }
}

const wf = (lastStatus.workflow as { status?: string } | null) ?? null;
if (wf?.status !== 'complete') {
  console.error(`workflow did not reach complete status; final=${wf?.status}`);
  process.exit(1);
}

console.log('✓ dynamic workflow drained all 3 tasks in order, instance complete');
