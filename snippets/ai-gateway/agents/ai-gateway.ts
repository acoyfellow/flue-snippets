// batch-b/06-ai-gateway — Flue + Cloudflare AI Gateway
//
// Every prompt routes through Cloudflare AI Gateway: caching, retry,
// cost tracking, request logs — all by toggling one option on the
// `env.AI` binding.
//
// Pattern: a Flue agent is just a request handler with a session shell.
// We use Workers AI through env.AI directly (instead of pi-ai's HTTP
// path) so we can pass the `gateway` option to the binding. The binding
// authenticates itself; the deploy doesn't need an AI-Gateway-scoped
// token.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  AI: { run: (model: string, args: unknown, opts?: unknown) => Promise<{ response: string }> };
  CLOUDFLARE_GATEWAY_ID: string;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const result = await env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct',
    { prompt: payload.message },
    {
      gateway: {
        id: env.CLOUDFLARE_GATEWAY_ID, // gateway auto-creates on first hit
        skipCache: false,
        cacheTtl: 3600,
      },
    },
  );

  return {
    answer: result.response,
    gateway: env.CLOUDFLARE_GATEWAY_ID,
    note: 'cached + observed via Cloudflare AI Gateway',
  };
}
