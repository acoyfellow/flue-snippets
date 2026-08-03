'use agent';

import { env } from 'cloudflare:workers';
import { createLabClient } from '@acoyfellow/lab';
import { defineTool, useDelivery, useModel, usePersistentState, useTool } from '@flue/runtime';

type CheckpointRequest = {
  message?: string;
  every?: number;
  stop?: boolean;
};

type RuntimeEnv = {
  LAB_URL?: string;
  LAB_AUTH_TOKEN?: string;
};

function requestFromBody(body: string): CheckpointRequest {
  try {
    return JSON.parse(body) as CheckpointRequest;
  } catch {
    return { message: body };
  }
}

export function LabCheckpoint() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const [cycle, setCycle] = usePersistentState('cycle', 0);
  const delivery = useDelivery();
  const body = delivery.kind === 'user' ? delivery.body : '';

  useTool(
    defineTool({
      name: 'checkpoint_agent_work',
      description: 'Answer the delivered request and create a Lab receipt at the first, periodic, or stop checkpoint.',
      harness: true,
      async run({ harness }) {
        const runtime = env as unknown as RuntimeEnv;
        const request = requestFromBody(body);
        const nextCycle = cycle + 1;
        const message = request.message ?? '';
        const answer = (await harness.prompt(message)).text;
        const every = request.every ?? 3;
        const shouldCheckpoint = nextCycle === 1 || nextCycle % every === 0 || request.stop === true;
        setCycle(nextCycle);
        if (!shouldCheckpoint) {
          return { output: { cycle: nextCycle, answer, receipt: null } };
        }
        const labUrl = runtime.LAB_URL ?? 'https://lab.coey.dev';
        const lab = createLabClient({ baseUrl: labUrl, token: runtime.LAB_AUTH_TOKEN });
        const result = await lab.createReceipt({
          source: 'flue-snippets/recipes/lab-checkpoint',
          action: 'agent.checkpoint',
          ok: true,
          input: { message },
          output: { cycle: nextCycle, answer },
          metadata: { reason: request.stop ? 'stop' : 'interval' },
        });
        return {
          output: {
            cycle: nextCycle,
            answer,
            receipt: `${labUrl}/results/${result.resultId}`,
          },
        };
      },
    }),
  );

  return 'Call checkpoint_agent_work exactly once for every delivered JSON request. Return its output as JSON without changing field names.';
}
