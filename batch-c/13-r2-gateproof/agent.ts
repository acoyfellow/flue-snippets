// batch-c/13-r2-gateproof — Flue + R2 sandbox + gateproof
//
// An agent edits docs in an R2-mounted filesystem, gateproof verifies
// the docs still satisfy the contract (links work, tone preserved, no
// secrets leaked). If gates fail, the agent reads the failing receipt
// and tries again.

import type { FlueContext } from '@flue/sdk/client';
import { getVirtualSandbox } from '@flue/sdk/cloudflare';
import { gateproof } from 'gateproof';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const sandbox = await getVirtualSandbox(env.DOCS_BUCKET);

  const agent = await init({ sandbox, model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  for (let attempt = 1; attempt <= 3; attempt++) {
    await session.skill('edit-doc', { args: payload });

    const proof = await gateproof('./gates/docs-quality.ts', {
      cwd: '/workspace',
    });
    if (proof.ok) {
      return { ok: true, attempts: attempt, proof: proof.url };
    }

    await session.prompt(
      `Gate "${proof.failingGate.name}" failed: ${proof.failingGate.reason}. ` +
      `Read the proof at ${proof.url} and revise the doc.`
    );
  }

  return { ok: false, attempts: 3 };
}
