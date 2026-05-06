// batch-b/06-ai-gateway — Flue + Cloudflare AI Gateway
//
// The same Flue agent, routed through Cloudflare AI Gateway. You get
// caching, observability, retry, rate limiting, and cost tracking — for
// every prompt — with a 3-line config change.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({
    model: 'openai/gpt-5.5',
    providers: {
      openai: {
        baseUrl:
          `https://gateway.ai.cloudflare.com/v1/` +
          `${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/openai`,
        apiKey: env.OPENAI_API_KEY,
      },
    },
  });
  const session = await agent.session();

  // Every prompt now hits AI Gateway: cached, logged, rate-limited.
  return await session.prompt(payload.message);
}
