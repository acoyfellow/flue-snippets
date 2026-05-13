// batch-a/01-lab-receipt — Flue + lab
//
// A Flue agent that runs a prompt and emits a Lab receipt for the run.
// One URL is the entire interface to anyone who wants to audit, fork,
// or hand the work off to the next agent.
//
// Uses Workers AI (kimi-k2.6) for the model call — cheap, idiomatic
// for the Cloudflare target, no separate vendor key needed.

import { createLabClient } from '@acoyfellow/lab';
import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const lab = createLabClient({ baseUrl: env.LAB_URL });

  const agent = await init({
    model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
  });
  const session = await agent.session();

  const answer = await session.prompt(payload.message);

  const r = await lab.createReceipt({
    source: 'flue',
    action: 'prompt',
    input: { message: payload.message },
    output: { answer },
    capabilities: ['model.cloudflare-workers-ai'],
  });

  return {
    answer,
    receipt: `${env.LAB_URL}/results/${r.resultId}`,
  };
}
