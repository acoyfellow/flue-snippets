'use agent';

import { type JsonValue, defineTool, useDelivery, useModel, usePersistentState, useTool } from '@flue/runtime';

type Task = {
  id: string;
  kind: string;
  value: JsonValue;
  processedAt: string;
};

type DynamicRequest = {
  runId?: string;
  action?: string;
  task?: { kind?: unknown; value?: unknown };
};

function requestFromBody(body: string): DynamicRequest {
  try {
    return JSON.parse(body) as DynamicRequest;
  } catch {
    return {};
  }
}

export function DynamicWorkflow() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const [completed, setCompleted] = usePersistentState<Task[]>('completed', []);
  const delivery = useDelivery();
  const body = delivery.kind === 'user' ? delivery.body : '';

  useTool(
    defineTool({
      name: 'orchestrate_dynamic_task',
      description: 'Accept one dynamic task or inspect the completed task log for this agent instance.',
      async run() {
        const request = requestFromBody(body);
        if (request.action === 'status') {
          return {
            output: {
              runId: request.runId ?? '',
              ok: true,
              error: '',
              enqueued: null,
              completed,
              queueSize: 0,
            },
          };
        }

        const kind = request.task?.kind;
        if (typeof kind !== 'string' || kind.length === 0) {
          return {
            output: {
              runId: request.runId ?? '',
              ok: false,
              error: 'task.kind is required',
              enqueued: null,
              completed,
              queueSize: 0,
            },
          };
        }

        const task: Task = {
          id: crypto.randomUUID(),
          kind,
          value: (request.task?.value ?? null) as JsonValue,
          processedAt: new Date().toISOString(),
        };
        const nextCompleted = [...completed, task];
        setCompleted(nextCompleted);
        return {
          output: {
            runId: request.runId ?? '',
            ok: true,
            error: '',
            enqueued: task,
            completed: nextCompleted,
            queueSize: 0,
          },
        };
      },
    }),
  );

  return 'For every incoming JSON command, call orchestrate_dynamic_task exactly once. Return its output as JSON without changing field names.';
}
