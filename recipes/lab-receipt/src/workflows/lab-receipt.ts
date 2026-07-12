import { env } from 'cloudflare:workers';
import { createLabClient } from '@acoyfellow/lab';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/lab-receipt — a Flue 1.0 workflow that runs a prompt and emits a
// Lab receipt for the run. One URL is the entire audit/fork/hand-off interface.

interface Env {
  LAB_URL: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.string() }),
  output: v.object({ answer: v.string(), receipt: v.string() }),
  async run({ harness, input }) {
    const { LAB_URL } = env as unknown as Env;
    const lab = createLabClient({ baseUrl: LAB_URL });
    const session = await harness.session();
    const response = await session.prompt(input.message);
    const answer = response.text;
    const r = await lab.createReceipt({
      source: 'flue',
      action: 'prompt',
      input: { message: input.message },
      output: { answer },
      capabilities: ['model.cloudflare-workers-ai'],
    });
    return { answer, receipt: `${LAB_URL}/results/${r.resultId}` };
  },
});
