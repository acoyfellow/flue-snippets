// batch-a/05-capa-stripe — Flue + capa
//
// A Flue agent that issues a Stripe refund through capa. The agent never
// sees the Stripe key. capa is bound as a Worker service binding; the
// host Worker's wrangler config declares:
//
//   "services": [{
//     "binding": "STRIPE",
//     "service": "capa-stripe",
//     "entrypoint": "StripeCapability"
//   }]
//
// Every call returns { result, evidence } so the receipt is a literal
// audit trail.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

interface StripeBinding {
  refunds: {
    create: (args: {
      charge: string;
      amount: number;
    }) => Promise<{ result: { id: string }; evidence: unknown }>;
  };
}

interface Env {
  STRIPE: StripeBinding;
}

export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  const decision = await session.skill('classify-refund-request', {
    args: { message: payload.message },
    result: {
      type: 'object',
      properties: {
        refund: { type: 'boolean' },
        amount: { type: 'number' },
      },
    },
  });

  if (!decision.refund) return { action: 'denied', reason: decision };

  // Service binding call. Stripe key never enters the agent's context;
  // capa-stripe owns it.
  const { result, evidence } = await env.STRIPE.refunds.create({
    charge: payload.chargeId,
    amount: decision.amount,
  });

  return { action: 'refunded', stripeId: result.id, evidence };
}
