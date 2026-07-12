import { env } from 'cloudflare:workers';
import { createLabClient } from '@acoyfellow/lab';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/lab-checkpoint — store Lab receipts at the moments where an agent's
// state matters: start, interval checkpoints, and stop. Flue 1.0 workflow;
// caller threads `cycle` in/out.

interface Env {
  LAB_URL?: string;
  LAB_AUTH_TOKEN?: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({
    message: v.string(),
    cycle: v.optional(v.number()),
    every: v.optional(v.number()),
    stop: v.optional(v.boolean()),
  }),
  output: v.object({ cycle: v.number(), answer: v.string(), receipt: v.optional(v.string()) }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const labUrl = e.LAB_URL ?? 'https://lab.coey.dev';
    const session = await harness.session();
    const response = await session.prompt(input.message);
    const answer = response.text;
    const cycle = (input.cycle ?? 0) + 1;
    const shouldCheckpoint = cycle === 1 || cycle % (input.every ?? 3) === 0 || input.stop === true;
    if (!shouldCheckpoint) return { cycle, answer };
    const lab = createLabClient({ baseUrl: labUrl, token: e.LAB_AUTH_TOKEN });
    const r = await lab.createReceipt({
      source: 'flue-snippets/recipes/lab-checkpoint',
      action: 'agent.checkpoint',
      ok: true,
      input: { message: input.message },
      output: { cycle, answer },
      metadata: { reason: input.stop ? 'stop' : 'interval' },
    });
    return { cycle, answer, receipt: `${labUrl}/results/${r.resultId}` };
  },
});
