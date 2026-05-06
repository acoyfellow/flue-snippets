// batch-a/05-capa-stripe — Flue + capa
//
// A Flue agent that issues a Stripe refund through capa. The agent never
// sees the Stripe key. The receipt records the action and the evidence
// (Stripe response IDs, capability granted) for audit.

import type { FlueContext } from '@flue/sdk/client';
import { stripe } from '@acoyfellow/capa/stripe';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  // The agent decides whether to refund based on the dispute message.
  const decision = await session.skill('classify-refund-request', {
    args: { message: payload.message },
    result: { type: 'object', properties: { refund: { type: 'boolean' }, amount: { type: 'number' } } },
  });

  if (!decision.refund) {
    return { action: 'denied', reason: decision };
  }

  // capa returns the Stripe result AND structured evidence. The agent's
  // bearer token can ONLY do refunds; capa enforces capability boundaries.
  const { result, evidence } = await stripe.refunds.create({
    charge: payload.chargeId,
    amount: decision.amount,
  });

  return { action: 'refunded', stripeId: result.id, evidence };
}
