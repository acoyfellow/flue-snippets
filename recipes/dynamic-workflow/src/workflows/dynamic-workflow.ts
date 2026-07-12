import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/dynamic-workflow — Flue 1.0 workflow front door over a co-hosted
// TaskQueue DO + Cloudflare Workflow (src/cloudflare.ts). The workflow STEPS
// are not declared statically: callers enqueue tasks at runtime and the
// Cloudflare Workflow drains the DO queue tick by tick via step.do(), so each
// task gets durable retries + observability.
//
// action 'enqueue' → push a task into the run's DO queue + ensure-start the
//   Cloudflare Workflow (idempotent on runId).
// action 'status'  → return Workflow instance status + DO queue size + completed.

interface Task {
  id: string;
  kind: string;
  value: unknown;
}
interface RunnerEnv {
  TASK_QUEUE: {
    get: (id: unknown) => { fetch: (u: string, i?: RequestInit) => Promise<Response> };
    idFromName: (n: string) => unknown;
  };
  TASK_RUNNER: {
    create: (o: { id: string; params: { runId: string } }) => Promise<unknown>;
    get: (id: string) => Promise<{ status: () => Promise<unknown> }>;
  };
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({
    runId: v.string(),
    action: v.optional(v.picklist(['enqueue', 'status'])),
    task: v.optional(v.object({ kind: v.string(), value: v.unknown() })),
  }),
  output: v.object({
    runId: v.string(),
    ok: v.optional(v.boolean()),
    enqueued: v.optional(v.unknown()),
    queueSize: v.optional(v.number()),
    started: v.optional(v.boolean()),
    workflow: v.optional(v.unknown()),
    completed: v.optional(v.array(v.unknown())),
    error: v.optional(v.string()),
  }),
  async run({ input }) {
    const e = env as unknown as RunnerEnv;
    const runId = input.runId;
    const action = input.action ?? 'enqueue';
    const queue = e.TASK_QUEUE.get(e.TASK_QUEUE.idFromName(runId));

    if (action === 'status') {
      let workflow: unknown = null;
      try {
        const wf = await e.TASK_RUNNER.get(runId);
        workflow = await wf.status();
      } catch {
        // not started yet
      }
      const sizeRes = await queue.fetch('https://q/size');
      const { size } = (await sizeRes.json()) as { size: number };
      const compRes = await queue.fetch('https://q/completed');
      const { completed } = (await compRes.json()) as { completed: unknown[] };
      return { runId, ok: true, workflow, queueSize: size, completed };
    }

    const task = input.task;
    if (!task || typeof task.kind !== 'string') {
      return {
        runId,
        ok: false,
        error: 'task.kind is required (e.g. { kind: "echo", value: "hi" })',
      };
    }
    const pushRes = await queue.fetch('https://q/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task }),
    });
    const pushBody = (await pushRes.json()) as { enqueued: Task; size: number };
    let started = false;
    try {
      await e.TASK_RUNNER.create({ id: runId, params: { runId } });
      started = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/exists|duplicate|already/i.test(msg)) throw err;
    }
    return { runId, ok: true, enqueued: pushBody.enqueued, queueSize: pushBody.size, started };
  },
});
