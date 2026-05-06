// batch-a/01-lab-receipt — Flue + lab
//
// A Flue agent that runs a prompt and emits a Lab receipt for the run.
// One URL is the entire interface to anyone who wants to audit, fork,
// or hand the work off to the next agent.

import type { FlueContext } from '@flue/sdk/client';
import { createLabClient } from '@acoyfellow/lab';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const lab = createLabClient({ baseUrl: env.LAB_URL });

  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  const answer = await session.prompt(payload.message);

  const r = await lab.createReceipt({
    source: 'flue',
    action: 'prompt',
    input: { message: payload.message },
    output: { answer },
    capabilities: ['model.anthropic'],
  });

  return {
    answer,
    receipt: `${env.LAB_URL}/results/${r.resultId}`,
  };
}
