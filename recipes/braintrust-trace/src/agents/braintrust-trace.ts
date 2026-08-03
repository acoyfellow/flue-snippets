'use agent';

import { env } from 'cloudflare:workers';
import { defineTool, useModel, useTool } from '@flue/runtime';
import { initLogger } from 'braintrust';
import * as v from 'valibot';

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_PROJECT: string;
}

const braintrustTracedPrompt = defineTool({
  name: 'braintrust_traced_prompt',
  description: 'Answer a request with Workers AI while recording and flushing a Braintrust application trace.',
  input: v.object({ message: v.string() }),
  harness: true,
  async run({ data, harness }) {
    const configuration = env as unknown as Env;
    const logger = initLogger({
      apiKey: configuration.BRAINTRUST_API_KEY,
      projectName: configuration.BRAINTRUST_PROJECT,
      noExitFlush: true,
    });
    try {
      const answer = await logger.traced(
        async (span) => {
          span.log({
            input: { message: data.message },
            metadata: { integration: 'flue-snippets', provider: 'workers-ai' },
          });
          const response = await harness.prompt(data.message);
          span.log({ output: { answer: response.text } });
          return response.text;
        },
        { name: 'flue.braintrust-trace.prompt' },
      );
      return {
        output: {
          answer,
          project: configuration.BRAINTRUST_PROJECT,
          traceFlushCompleted: true,
        },
      };
    } finally {
      await logger.flush();
    }
  },
});

export function BraintrustTrace() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useTool(braintrustTracedPrompt);
  return 'For every user request, call braintrust_traced_prompt exactly once with the request, then return its answer.';
}
