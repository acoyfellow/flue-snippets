// batch-c/11-gateway-lab — Flue + AI Gateway + lab
//
// Two observability planes composed:
//   - AI Gateway sees the model traffic (latency, cost, cache hits, retries)
//   - Lab sees the work (input, output, capabilities, parent receipts)
//
// Same prompt, two complete audit trails. Uses env.AI binding directly
// (instead of pi-ai HTTP) so we can pass the gateway option without
// needing AI Gateway perms on the deploy token.

import { createLabClient } from '@acoyfellow/lab';
import type { FlueContext } from '@flue/sdk/client';

interface Env {
  AI: { run: (model: string, args: unknown, opts?: unknown) => Promise<{ response: string }> };
  CLOUDFLARE_GATEWAY_ID: string;
  LAB_URL: string;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const lab = createLabClient({ baseUrl: env.LAB_URL });

  const ai = await env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct',
    { prompt: payload.message },
    { gateway: { id: env.CLOUDFLARE_GATEWAY_ID } },
  );

  const r = await lab.createReceipt({
    source: 'flue-snippets/recipes/gateway-lab',
    action: 'prompt',
    input: { message: payload.message },
    output: { answer: ai.response },
    capabilities: ['model.workers-ai-via-gateway'],
    metadata: {
      gatewayId: env.CLOUDFLARE_GATEWAY_ID,
      model: '@cf/meta/llama-3.1-8b-instruct',
    },
  });

  return {
    answer: ai.response,
    receipt: `${env.LAB_URL}/results/${r.resultId}`,
    gateway: env.CLOUDFLARE_GATEWAY_ID,
  };
}
