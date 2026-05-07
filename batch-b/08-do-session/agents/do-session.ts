// batch-b/08-do-session — Flue + Durable Object sessions
//
// One agent per user, persisted across requests, surviving restarts and
// geo-pinning to the user's location. Zero session-store code — Flue
// handles it via DOs automatically when deployed to Cloudflare.
//
// Uses Workers AI (llama-4-scout) so this snippet is free-tier-friendly
// and has no third-party vendor key requirement.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

// POST /agents/do-session/<userId>
//
// Flue routes by the path segment after the agent name. Same userId =
// same DO = same conversation history. New userId = fresh agent.
export default async function ({ init, payload }: FlueContext) {
  const agent = await init({
    model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
  });
  const session = await agent.session();

  // Message history is durable, geo-pinned to the user, restart-safe.
  // No Redis, no Postgres, no manual session store. Just DO + Flue.
  const answer = await session.prompt(payload.message);
  return { answer };
}
