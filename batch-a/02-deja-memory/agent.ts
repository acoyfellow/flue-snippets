// batch-a/02-deja-memory — Flue + deja
//
// A Flue agent that recalls relevant memory before answering and remembers
// the new exchange after. The agent stops being amnesiac.

import type { FlueContext } from '@flue/sdk/client';
import { Deja } from '@acoyfellow/deja';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const deja = new Deja({ baseUrl: env.DEJA_URL });

  // Pull memory relevant to this question.
  const recalled = await deja.recall(payload.question, { limit: 5 });

  const agent = await init({
    model: 'anthropic/claude-sonnet-4-6',
    role: 'researcher',
  });
  const session = await agent.session({
    system: `Relevant memory:\n${recalled.formatted}`,
  });

  const answer = await session.prompt(payload.question);

  // Persist the exchange so the next agent benefits.
  await deja.remember({
    text: `Q: ${payload.question}\nA: ${answer}`,
    tags: ['qa', payload.topic ?? 'general'],
    keep: true,
  });

  return { answer, memoryUsed: recalled.hits.length };
}
