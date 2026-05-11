// examples/workers-ai — call Workers AI from a Flue agent.
//
// The simplest possible CF-deployed Flue agent: bind Workers AI, run a
// model, return the answer.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  AI: { run: (model: string, args: unknown) => Promise<{ response: string }> };
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const out = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: payload.message ?? 'Say hi.',
  });
  return { answer: out.response };
}
