import { env } from 'cloudflare:workers';
import { createLabClient } from '@acoyfellow/lab';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/gateway-lab — two observability planes composed: the AI Gateway sees
// the model traffic (latency/cost/cache/retries, configured in app.ts), and Lab
// sees the work (input/output/capabilities). Flue 1.0 workflow.

interface Env {
  CLOUDFLARE_GATEWAY_ID: string;
  LAB_URL: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.string() }),
  output: v.object({ answer: v.string(), receipt: v.string(), gateway: v.string() }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const session = await harness.session();
    const response = await session.prompt(input.message);
    const answer = response.text;
    const lab = createLabClient({ baseUrl: e.LAB_URL });
    const r = await lab.createReceipt({
      source: 'flue-snippets/recipes/gateway-lab',
      action: 'prompt',
      input: { message: input.message },
      output: { answer },
      capabilities: ['model.workers-ai-via-gateway'],
      metadata: { gatewayId: e.CLOUDFLARE_GATEWAY_ID, model: '@cf/moonshotai/kimi-k2.6' },
    });
    return {
      answer,
      receipt: `${e.LAB_URL}/results/${r.resultId}`,
      gateway: e.CLOUDFLARE_GATEWAY_ID,
    };
  },
});
