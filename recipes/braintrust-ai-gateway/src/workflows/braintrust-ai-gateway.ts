import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/braintrust-ai-gateway — Flue 1.0 workflow calling the hosted Braintrust
// AI Gateway (OpenAI-compatible). A Braintrust credential authenticates the request
// and x-bt-parent asks the gateway to log it in a project trace. No env.AI binding.

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_GATEWAY_URL: string;
  BRAINTRUST_MODEL: string;
  BRAINTRUST_PROJECT: string;
}
interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

// The gateway does the model call; the workflow agent is a formality (Flue
// requires one), never used for a prompt here.
const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({
    answer: v.string(),
    gateway: v.string(),
    model: v.string(),
    loggedSpan: v.boolean(),
  }),
  async run({ input }) {
    const e = env as unknown as Env;
    const response = await fetch(`${e.BRAINTRUST_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${e.BRAINTRUST_API_KEY}`,
        'content-type': 'application/json',
        'x-bt-parent': `project_name:${e.BRAINTRUST_PROJECT}`,
      },
      body: JSON.stringify({
        model: e.BRAINTRUST_MODEL,
        messages: [{ role: 'user', content: input.message ?? 'Say hi.' }],
        temperature: 0,
      }),
    });
    if (!response.ok)
      throw new Error(`Braintrust gateway HTTP ${response.status}: ${await response.text()}`);
    const completion = (await response.json()) as ChatCompletion;
    const answer = completion.choices?.[0]?.message?.content;
    if (!answer) throw new Error('Braintrust gateway returned no assistant text');
    return {
      answer,
      gateway: e.BRAINTRUST_GATEWAY_URL,
      model: e.BRAINTRUST_MODEL,
      loggedSpan: Boolean(response.headers.get('x-bt-span-id')),
    };
  },
});
