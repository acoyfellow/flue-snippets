// recipes/dynamic-workflow/runner.ts, the durable backend.
//
// NOT a Flue agent. A raw Worker that hosts three exports:
//
//   1. TaskQueue (Durable Object), one queue per workflow run id. Holds
//      a list of pending tasks in DO storage. The Flue agent pushes
//      into it; the workflow pops from it.
//
//   2. TaskRunnerWorkflow (WorkflowEntrypoint), the dynamic workflow.
//      Its `run()` is a tick loop that pops a task from the DO and
//      executes it inside a `step.do(\`tick-N\`, …)` — meaning every
//      task gets durable retries, persisted output, and a step name in
//      the Workflows dashboard, even though none of those steps were
//      declared in code. The shape of work is decided at runtime by
//      whoever enqueues.
//
//   3. default.fetch, the control plane the Flue agent calls:
//        POST /enqueue/:runId  body: { task }
//        GET  /status/:runId
//      `/enqueue` is idempotent — first call also creates the workflow
//      instance, subsequent calls just append to the queue.
//
// Why colocate the DO and the Workflow in the same Worker?
// Workflow bindings require the workflow class to be exported from the
// same script that owns the binding (or an explicit `scriptName`). The
// DO has to live somewhere too; here it shares the script so the
// workflow can `this.env.QUEUE` straight into the DO without crossing
// Worker boundaries.

import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

interface Task {
  id: string;
  kind: string;
  value: unknown;
  enqueuedAt: string;
}

// ---------------------------------------------------------------------------
// 1. Durable Object: one task queue per runId
// ---------------------------------------------------------------------------

export class TaskQueue extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const op = url.pathname.replace(/^\//, '');

    if (op === 'push' && request.method === 'POST') {
      const { task } = (await request.json()) as { task: Omit<Task, 'id' | 'enqueuedAt'> };
      const queue = ((await this.ctx.storage.get<Task[]>('queue')) ?? []).slice();
      const entry: Task = {
        id: crypto.randomUUID(),
        kind: task.kind,
        value: task.value,
        enqueuedAt: new Date().toISOString(),
      };
      queue.push(entry);
      await this.ctx.storage.put('queue', queue);
      return Response.json({ ok: true, size: queue.length, enqueued: entry });
    }

    if (op === 'shift') {
      const queue = ((await this.ctx.storage.get<Task[]>('queue')) ?? []).slice();
      const task = queue.shift();
      await this.ctx.storage.put('queue', queue);
      return Response.json({ ok: true, size: queue.length, task: task ?? null });
    }

    if (op === 'size') {
      const queue = (await this.ctx.storage.get<Task[]>('queue')) ?? [];
      return Response.json({ ok: true, size: queue.length });
    }

    if (op === 'completed' && request.method === 'POST') {
      const { result } = (await request.json()) as { result: unknown };
      const log = ((await this.ctx.storage.get<unknown[]>('completed')) ?? []).slice();
      log.push(result);
      await this.ctx.storage.put('completed', log);
      return Response.json({ ok: true, count: log.length });
    }

    if (op === 'completed') {
      const log = (await this.ctx.storage.get<unknown[]>('completed')) ?? [];
      return Response.json({ ok: true, completed: log });
    }

    return Response.json({ error: `unknown op: ${op}` }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// 2. Workflow: dynamic step loop driven by the DO queue
// ---------------------------------------------------------------------------

type WorkflowParams = { runId: string };

const MAX_TICKS = 60; // safety bound; the workflow gives up if the queue stays empty this long
const IDLE_SLEEP: `${number} second${'s' | ''}` = '2 seconds';

export class TaskRunnerWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  override async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { runId } = event.payload;
    const queue = this.env.TASK_QUEUE.get(this.env.TASK_QUEUE.idFromName(runId));

    let idleTicks = 0;

    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      // The crucial line: `step.do` with a runtime-generated name. Each
      // task becomes a real, replayable, retryable step — but the set
      // of steps is decided by whatever the caller enqueued, not by
      // anything declared at deploy time.
      const result = await step.do(`tick-${tick}`, async () => {
        const res = await queue.fetch('https://q/shift');
        const body = (await res.json()) as { task: Task | null; size: number };

        if (!body.task) return { tick, idle: true, remaining: body.size };

        // Execute the task. In a real recipe you'd dispatch on `kind` to
        // a registry of handlers — call AI, hit an API, fan out to
        // queues, whatever. For the snippet's e2e proof we keep it
        // deterministic and side-effect-light: echo the value with a
        // tick stamp so the probe can assert ordering.
        const out = {
          tick,
          taskId: body.task.id,
          kind: body.task.kind,
          value: body.task.value,
          processedAt: new Date().toISOString(),
        };

        // Record completion back into the same DO so /status can return it.
        await queue.fetch('https://q/completed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ result: out }),
        });

        return { ...out, idle: false, remaining: body.size };
      });

      if (result.idle) {
        idleTicks++;
        if (idleTicks >= 3) {
          // Queue's been empty for three checks in a row; assume the
          // burst is done and exit. A long-running variant would
          // `step.waitForEvent` here instead.
          return { runId, ticks: tick, exit: 'idle-drain' };
        }
        await step.sleep(`idle-${tick}`, IDLE_SLEEP);
      } else {
        idleTicks = 0;
      }
    }

    return { runId, ticks: MAX_TICKS, exit: 'max-ticks' };
  }
}

// ---------------------------------------------------------------------------
// 3. Control-plane fetch handler (called by the Flue agent over service binding)
// ---------------------------------------------------------------------------

interface Env {
  TASK_QUEUE: DurableObjectNamespace<TaskQueue>;
  TASK_RUNNER: Workflow<WorkflowParams>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const [, op, runId] = url.pathname.split('/');

    if (!op) {
      return Response.json({
        ok: true,
        name: 'dynamic-workflow runner',
        routes: ['POST /enqueue/:runId', 'GET /status/:runId'],
      });
    }

    if (!runId) {
      return Response.json({ error: 'runId required' }, { status: 400 });
    }

    const queueStub = env.TASK_QUEUE.get(env.TASK_QUEUE.idFromName(runId));

    if (op === 'enqueue' && request.method === 'POST') {
      const { task } = (await request.json()) as { task: { kind: string; value: unknown } };

      // 1) Push into the per-run DO queue.
      const pushRes = await queueStub.fetch('https://q/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      const pushBody = (await pushRes.json()) as { enqueued: Task; size: number };

      // 2) Ensure-start the workflow. Cloudflare Workflows dedupes on
      //    `id`, so calling create() repeatedly with the same id is a
      //    no-op after the first call. We catch the duplicate-id error
      //    just in case the platform stops being a no-op in the future.
      let started = false;
      try {
        await env.TASK_RUNNER.create({ id: runId, params: { runId } });
        started = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Workflow already exists for this id — desired path on every
        // call after the first.
        if (!/exists|duplicate|already/i.test(msg)) throw err;
      }

      return Response.json({
        ok: true,
        enqueued: pushBody.enqueued,
        queueSize: pushBody.size,
        started,
      });
    }

    if (op === 'status' && request.method === 'GET') {
      let workflow: Awaited<ReturnType<Workflow<WorkflowParams>['get']>> | null = null;
      let workflowStatus: unknown = null;
      try {
        workflow = await env.TASK_RUNNER.get(runId);
        workflowStatus = await workflow.status();
      } catch (_) {
        // Workflow doesn't exist yet; that's fine, status stays null.
      }

      const sizeRes = await queueStub.fetch('https://q/size');
      const { size } = (await sizeRes.json()) as { size: number };

      const completedRes = await queueStub.fetch('https://q/completed');
      const { completed } = (await completedRes.json()) as { completed: unknown[] };

      return Response.json({
        ok: true,
        workflow: workflowStatus,
        queueSize: size,
        completed,
      });
    }

    return Response.json({ error: `unknown route: ${request.method} /${op}` }, { status: 404 });
  },
};
