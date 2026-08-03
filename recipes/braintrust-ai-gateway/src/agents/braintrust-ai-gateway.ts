'use agent';

import { env } from 'cloudflare:workers';
import { defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_GATEWAY_URL: string;
  BRAINTRUST_MODEL: string;
  BRAINTRUST_PROJECT: string;
}

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null } }>;
}

const braintrustGatewayCompletion = defineTool({
  name: 'braintrust_gateway_completion',
  description: 'Request a completion through the configured Braintrust AI Gateway and record it in the configured project trace.',
  input: v.object({ message: v.string() }),
  async run({ data }) {
    const configuration = env as unknown as Env;
    const response = await fetch(`${configuration.BRAINTRUST_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${configuration.BRAINTRUST_API_KEY}`,
        'content-type': 'application/json',
        'x-bt-parent': `project_name:${configuration.BRAINTRUST_PROJECT}`,
      },
      body: JSON.stringify({
        model: configuration.BRAINTRUST_MODEL,
        messages: [{ role: 'user', content: data.message }],
        temperature: 0,
      }),
    });
    if (!response.ok) {
      throw new Error(`Braintrust gateway HTTP ${response.status}: ${await response.text()}`);
    }
    const completion = (await response.json()) as ChatCompletion;
    const answer = completion.choices?.[0]?.message?.content;
    if (!answer) throw new Error('Braintrust gateway returned no assistant text');
    return {
      output: {
        answer,
        gateway: configuration.BRAINTRUST_GATEWAY_URL,
        model: configuration.BRAINTRUST_MODEL,
        loggedSpan: Boolean(response.headers.get('x-bt-span-id')),
      },
    };
  },
});

export function BraintrustAiGateway() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useTool(braintrustGatewayCompletion);
  return 'For every user request, call braintrust_gateway_completion exactly once with the request, then return its answer and report whether the gateway logged a span.';
}
