// batch-d/18-lab-checkpoint — Flue + lab checkpoints
//
// Store receipts at the moments where an agent's state matters: start,
// checkpoint, and stop.

import { createLabClient } from '@acoyfellow/lab';
import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({
    model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
  });
  const session = await agent.session();
  const cycle = (payload.cycle ?? 0) + 1;

  const answer = await session.prompt(payload.message);
  const shouldCheckpoint =
    cycle === 1 || cycle % (payload.every ?? 3) === 0 || payload.stop === true;

  if (!shouldCheckpoint) return { cycle, answer };

  const lab = createLabClient({
    baseUrl: env.LAB_URL ?? 'https://lab.coey.dev',
    token: env.LAB_AUTH_TOKEN,
  });

  const r = await lab.createReceipt({
    source: 'flue-snippets/recipes/lab-checkpoint',
    action: 'agent.checkpoint',
    ok: true,
    input: { message: payload.message },
    output: { cycle, answer },
    metadata: { reason: payload.stop ? 'stop' : 'interval' },
  });

  return {
    cycle,
    answer,
    receipt: `${env.LAB_URL ?? 'https://lab.coey.dev'}/results/${r.resultId}`,
  };
}
