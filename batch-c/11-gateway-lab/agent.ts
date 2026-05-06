// batch-c/11-gateway-lab — Flue + AI Gateway + lab
//
// Every prompt goes through AI Gateway (cached, observable, rate-limited)
// AND every run leaves a Lab receipt. Two CF-aligned observability planes
// composed: the gateway sees the traffic, the receipt sees the work.

import type { FlueContext } from '@flue/sdk/client';
import { createLabClient } from '@acoyfellow/lab';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const lab = createLabClient({ baseUrl: env.LAB_URL });

  const agent = await init({
    model: 'openai/gpt-5.5',
    providers: {
      openai: {
        baseUrl:
          `https://gateway.ai.cloudflare.com/v1/` +
          `${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/openai`,
        apiKey: env.OPENAI_API_KEY,
      },
    },
  });
  const session = await agent.session();

  const answer = await session.prompt(payload.message);

  const r = await lab.createReceipt({
    source: 'flue',
    action: 'prompt',
    input: { message: payload.message },
    output: { answer },
    capabilities: ['model.openai', 'gateway.cf'],
    metadata: { gatewayId: env.AI_GATEWAY_ID },
  });

  return { answer, receipt: `${env.LAB_URL}/results/${r.resultId}` };
}
