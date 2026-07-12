import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/ai-gateway — Workers AI routed through a Cloudflare AI Gateway.
// The named gateway is configured in src/app.ts via registerProvider; the
// workflow just calls session.prompt and the provider routes through it
// (caching, observability, retries).

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string(), gateway: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(input.message ?? 'Say hi.');
    const gateway =
      (env as unknown as { CLOUDFLARE_GATEWAY_ID?: string }).CLOUDFLARE_GATEWAY_ID ?? 'jordan';
    return { answer: response.text, gateway };
  },
});
