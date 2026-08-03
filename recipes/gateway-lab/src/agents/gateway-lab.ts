'use agent';

import { env } from 'cloudflare:workers';
import { createLabClient } from '@acoyfellow/lab';
import { defineTool, useDelivery, useModel, useTool } from '@flue/runtime';

type PromptRequest = { message?: string };

type RuntimeEnv = {
  CLOUDFLARE_GATEWAY_ID: string;
  LAB_URL: string;
};

function requestFromBody(body: string): PromptRequest {
  try {
    return JSON.parse(body) as PromptRequest;
  } catch {
    return { message: body };
  }
}

export function GatewayLab() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const delivery = useDelivery();
  const body = delivery.kind === 'user' ? delivery.body : '';

  useTool(
    defineTool({
      name: 'prompt_with_gateway_receipt',
      description: 'Answer the delivered prompt and persist the answer as a Lab receipt with the gateway metadata.',
      harness: true,
      async run({ harness }) {
        const runtime = env as unknown as RuntimeEnv;
        const message = requestFromBody(body).message ?? '';
        const answer = (await harness.prompt(message)).text;
        const lab = createLabClient({ baseUrl: runtime.LAB_URL });
        const result = await lab.createReceipt({
          source: 'flue-snippets/recipes/gateway-lab',
          action: 'prompt',
          input: { message },
          output: { answer },
          capabilities: ['model.workers-ai-via-gateway'],
          metadata: {
            gatewayId: runtime.CLOUDFLARE_GATEWAY_ID,
            model: '@cf/moonshotai/kimi-k2.6',
          },
        });
        return {
          output: {
            answer,
            receipt: `${runtime.LAB_URL}/results/${result.resultId}`,
            gateway: runtime.CLOUDFLARE_GATEWAY_ID,
          },
        };
      },
    }),
  );

  return 'Call prompt_with_gateway_receipt exactly once for every delivered JSON request. Return its output as JSON without changing field names.';
}
