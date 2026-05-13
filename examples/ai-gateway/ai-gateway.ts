// examples/ai-gateway — Workers AI through a Cloudflare AI Gateway.
//
// `env.AI.run(model, args, { gateway: { id } })` routes the call through
// the named gateway. Caching, observability, retries — for free.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  AI: { run: (model: string, args: unknown, opts?: unknown) => Promise<{ response: string }> };
  CLOUDFLARE_GATEWAY_ID: string;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const out = await env.AI.run(
    '@cf/moonshotai/kimi-k2.6',
    { prompt: payload.message ?? 'Say hi.' },
    { gateway: { id: env.CLOUDFLARE_GATEWAY_ID, skipCache: false, cacheTtl: 3600 } },
  );
  return { answer: out.response, gateway: env.CLOUDFLARE_GATEWAY_ID };
}
