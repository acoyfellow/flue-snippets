// batch-c/15-platforms-capa — Flue + Workers for Platforms + capa
//
// A multi-tenant agent platform where each tenant gets their own Stripe
// account via capa, isolated by Workers for Platforms. The tenant's
// agent never sees the platform admin's keys; capa never lets one
// tenant touch another's data.

import type { FlueContext } from '@flue/sdk/client';
import { stripe } from '@acoyfellow/capa/stripe';

export const triggers = { webhook: true };

// Each tenant's agent. The runtime is the same; the tenant binding
// supplies their scoped capa token + their own R2 + their own DO.
export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({
    sandbox: env.WORKSPACE as any,
    model: 'anthropic/claude-sonnet-4-6',
  });
  const session = await agent.session();

  const decision = await session.skill('handle-customer-request', {
    args: payload,
    result: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['refund', 'reply', 'escalate'] },
        amount: { type: 'number' },
      },
    },
  });

  if (decision.action === 'refund') {
    // capa enforces: this tenant can only refund THEIR charges.
    // Token is provisioned per-tenant; agent can't steal another's keys.
    const { result, evidence } = await stripe(env.CAPA_TOKEN).refunds.create({
      charge: payload.chargeId,
      amount: decision.amount,
    });
    return { action: 'refunded', stripeId: result.id, evidence };
  }

  return decision;
}
