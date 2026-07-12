// Cloudflare-only Worker extension: co-host the TaskQueue Durable Object and
// the TaskRunnerWorkflow (a Cloudflare Workflow). Named exports become
// top-level Worker exports; bindings + migrations are declared in wrangler.jsonc.
// The Flue workflow front door (src/workflows/dynamic-workflow.ts) drives these
// via env.TASK_QUEUE / env.TASK_RUNNER on the same Worker.

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

type WorkflowParams = { runId: string };
const MAX_TICKS = 60;
const IDLE_SLEEP: `${number} second${'s' | ''}` = '2 seconds';

export class TaskRunnerWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  override async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { runId } = event.payload;
    const queue = this.env.TASK_QUEUE.get(this.env.TASK_QUEUE.idFromName(runId));
    let idleTicks = 0;
    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      const result = await step.do(`tick-${tick}`, async () => {
        const res = await queue.fetch('https://q/shift');
        const body = (await res.json()) as { task: Task | null; size: number };
        if (!body.task) return { tick, idle: true, remaining: body.size };
        const out = {
          tick,
          taskId: body.task.id,
          kind: body.task.kind,
          value: body.task.value,
          processedAt: new Date().toISOString(),
        };
        await queue.fetch('https://q/completed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ result: out }),
        });
        return { ...out, idle: false, remaining: body.size };
      });
      if (result.idle) {
        idleTicks++;
        if (idleTicks >= 3) return { runId, ticks: tick, exit: 'idle-drain' };
        await step.sleep(`idle-${tick}`, IDLE_SLEEP);
      } else {
        idleTicks = 0;
      }
    }
    return { runId, ticks: MAX_TICKS, exit: 'max-ticks' };
  }
}

interface Env {
  TASK_QUEUE: DurableObjectNamespace<TaskQueue>;
  TASK_RUNNER: Workflow<WorkflowParams>;
}
