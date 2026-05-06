// batch-a/03-gateproof-loop — Flue + gateproof
//
// A Flue agent that proves its work passes the gates before declaring
// victory. If gates fail, the agent reads the failure receipt and retries.
// Self-healing, capped at 3 attempts.

import type { FlueContext } from '@flue/sdk/client';
import { gateproof } from 'gateproof';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6', sandbox: 'local' });
  const session = await agent.session();

  for (let attempt = 1; attempt <= 3; attempt++) {
    await session.prompt(`Attempt ${attempt}: ${payload.task}`);

    const proof = await gateproof(payload.plan, { cwd: process.cwd() });
    if (proof.ok) {
      return { ok: true, attempts: attempt, proof: proof.url };
    }

    // Feed the failure back to the agent for the next attempt.
    await session.prompt(
      `The gate failed: ${proof.failingGate.reason}. ` +
      `Read the proof at ${proof.url} and adjust your approach.`
    );
  }

  return { ok: false, attempts: 3, reason: 'exceeded max attempts' };
}
