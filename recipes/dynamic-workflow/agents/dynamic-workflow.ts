// recipes/dynamic-workflow, Flue + Durable Object + Cloudflare Workflow.
//
// The Flue agent is the "front door". It accepts tasks and exposes status.
// The actual durable execution lives in a separate Worker (../runner.ts) that
// owns:
//   - the `TaskQueue` Durable Object (one queue per workflow run id)
//   - the `TaskRunnerWorkflow` Workflow class
//
// This file is intentionally thin. The whole point of the recipe is that
// the *workflow steps are not declared statically* in code. The agent (or
// any caller — an LLM, a UI, an upstream service) enqueues whatever work
// it wants at runtime, and the workflow drains the queue tick by tick
// using `step.do()` so every task gets durable retries, dedup, and
// observability for free.
//
// Composition:
//
//   POST /agents/dynamic-workflow/<runId>  body: { action, task? }
//     - action: 'enqueue' → push a task into the run's DO queue,
//                          starting the workflow on the first enqueue
//                          (idempotent — Workflows dedupes on id)
//     - action: 'status'  → return workflow instance status + DO queue size
//
// The `runId` path segment becomes BOTH the workflow instance id and
// the DO queue id, so they stay 1:1 and dispatch is trivial.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

// Minimal shape of the Workflow + DO bindings the agent calls. Both are
// injected by alchemy.run.ts — the runner Worker exports the classes,
// this Worker just speaks to them by binding name.
interface RunnerEnv {
  // Service binding to the runner Worker's default fetch handler.
  // We use it for one thing: ask the workflow for current status so the
  // probe can poll without hitting the Cloudflare API directly.
  RUNNER: { fetch: (input: string | Request, init?: RequestInit) => Promise<Response> };
  // Public URL of the runner Worker. Injected as a var so the agent can
  // print it for humans / debug; the actual calls go via the service
  // binding above.
  RUNNER_URL: string;
}

type EnqueuePayload = { action?: 'enqueue'; task?: { kind: string; value: unknown } };
type StatusPayload = { action: 'status' };
type Payload = EnqueuePayload | StatusPayload;

export default async function ({ id, payload, env }: FlueContext<Payload> & { env: RunnerEnv }) {
  const runId = id; // path segment = workflow instance id
  const action = (payload as { action?: string }).action ?? 'enqueue';

  if (action === 'status') {
    // The runner Worker exposes /status/:runId. We hop through the service
    // binding so the agent never needs Cloudflare API credentials.
    const res = await env.RUNNER.fetch(`https://runner/status/${runId}`);
    const body = (await res.json()) as Record<string, unknown>;
    return { runId, ...body };
  }

  const task = (payload as EnqueuePayload).task;
  if (!task || typeof task.kind !== 'string') {
    return { error: 'task.kind is required (e.g. { kind: "echo", value: "hi" })' };
  }

  // Enqueue + ensure-started. The runner is idempotent: it deduplicates
  // workflow creation on runId, so calling this N times for the same
  // runId only ever creates one workflow instance — every subsequent
  // call just appends to the DO queue.
  const res = await env.RUNNER.fetch(`https://runner/enqueue/${runId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { runId, ...body };
}
