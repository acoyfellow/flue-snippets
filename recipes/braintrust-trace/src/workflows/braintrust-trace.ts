import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import { initLogger } from 'braintrust';
import * as v from 'valibot';

// recipes/braintrust-trace — Flue 1.0 workflow + Braintrust application tracing.
// The model call goes through session.prompt; Braintrust records the surrounding
// operation as a trace span. flush() matters in a Worker (no process shutdown hook).

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_PROJECT: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string(), project: v.string(), traceFlushCompleted: v.boolean() }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const message = input.message ?? 'Say hi.';
    const logger = initLogger({
      apiKey: e.BRAINTRUST_API_KEY,
      projectName: e.BRAINTRUST_PROJECT,
      noExitFlush: true,
    });
    const session = await harness.session();
    const answer = await (async () => {
      try {
        return await logger.traced(
          async (span) => {
            span.log({
              input: { message },
              metadata: { integration: 'flue-snippets', provider: 'workers-ai' },
            });
            const response = await session.prompt(message);
            span.log({ output: { answer: response.text } });
            return response.text;
          },
          { name: 'flue.braintrust-trace.prompt' },
        );
      } finally {
        await logger.flush();
      }
    })();
    return { answer, project: e.BRAINTRUST_PROJECT, traceFlushCompleted: true };
  },
});
