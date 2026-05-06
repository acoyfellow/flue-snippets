// batch-a/02-deja-memory — Flue + deja
//
// A Flue agent that recalls relevant memory before answering and remembers
// the new exchange after. Deja is LOCAL-first: it opens a sqlite DB in
// process. For tests we use :memory:; for production point at a path.

import type { FlueContext } from '@flue/sdk/client';
import { Deja } from 'deja-jordan';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const deja = new Deja({ path: env.DEJA_PATH ?? ':memory:' });

  // recall(query, limit) — positional. Returns { hits, readFirst, activeHandoff }.
  const recalled = deja.recall(payload.question, 5);

  const formatted = recalled.hits
    .map((h) => `- ${h.slip.text}`)
    .join('\n') || '(no prior memory)';

  const agent = await init({
    model: 'anthropic/claude-sonnet-4-6',
    role: 'researcher',
  });
  const session = await agent.session({
    system: `Relevant memory:\n${formatted}`,
  });

  const answer = await session.prompt(payload.question);

  // remember(text, opts?) — positional text, optional opts.
  // keep=true promotes draft to kept (survives the 24h GC).
  deja.remember(`Q: ${payload.question}\nA: ${answer}`, {
    tags: ['qa', payload.topic ?? 'general'],
  });

  deja.close();
  return { answer, memoryUsed: recalled.hits.length };
}
