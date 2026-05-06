// batch-c/12-do-deja — Flue + DO sessions + deja
//
// Per-user DO holds the conversation. Deja holds the cross-session
// learnings. Two memory layers, two scopes, one agent. The DO doesn't
// duplicate Deja and vice versa.

import type { FlueContext } from '@flue/sdk/client';
import { Deja } from '@acoyfellow/deja';

export const triggers = { webhook: true };

// POST /agents/12-do-deja/<userId>
export default async function ({ init, payload, env }: FlueContext) {
  const deja = new Deja({ baseUrl: env.DEJA_URL });

  // Cross-session memory: things this user said weeks ago.
  const recalled = await deja.recall(payload.message, {
    scope: payload.userId,
    limit: 5,
  });

  const agent = await init({
    model: 'anthropic/claude-sonnet-4-6',
  });

  // DO-backed session: this conversation, this turn.
  const session = await agent.session({
    system: `Long-term memory for this user:\n${recalled.formatted}`,
  });

  const answer = await session.prompt(payload.message);

  // Promote significant exchanges to long-term memory.
  if (payload.persist) {
    await deja.remember({
      text: `${payload.userId}: ${payload.message} → ${answer}`,
      scope: payload.userId,
      keep: true,
    });
  }

  return { answer };
}
