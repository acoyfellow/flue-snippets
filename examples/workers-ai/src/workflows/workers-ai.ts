import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/workers-ai — the simplest CF-deployed Flue 1.0 workflow: run a
// Workers AI model and return the answer.
//
// The `cloudflare` provider is auto-registered on the Cloudflare target from
// the `AI` binding (see wrangler.jsonc). No app.ts needed unless you want to
// customize the AI Gateway. Model ids take the form `cloudflare/@cf/<model>`.

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
}));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(input.message ?? 'Say hi.');
    return { answer: response.text };
  },
});
