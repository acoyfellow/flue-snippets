import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/braintrust-eval — the system under test for a Braintrust evaluation:
// a small real Flue 1.0 workflow. eval.ts runs a Braintrust experiment against
// the deployed endpoint.

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string(), provider: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(input.message ?? 'Say hi.');
    return { answer: response.text, provider: 'workers-ai' };
  },
});
