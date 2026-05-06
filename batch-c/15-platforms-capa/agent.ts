// batch-c/15-platforms-capa — Flue + Workers for Platforms + capa
//
// Multi-tenant Flue host where each tenant agent is a Worker for Platforms
// child, with its own service binding to a per-tenant capa-stripe Worker.
// Per-tenant V8 isolation + per-tenant scoped Stripe access.
//
// The TENANT'S Worker config (uploaded via the platform API) declares:
//   "services": [{
//     "binding": "STRIPE",
//     "service": "capa-stripe-<tenant>",
//     "entrypoint": "StripeCapability"
//   }]
//
// One capa-stripe deployment per tenant, each with its own STRIPE_API_KEY
// secret. A tenant's agent literally cannot reach another tenant's
// account because the binding is per-tenant.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

interface StripeBinding {
  refunds: {
    create: (args: { charge: string; amount: number }) => Promise<{
      result: { id: string };
      evidence: unknown;
    }>;
  };
}

interface Env {
  STRIPE: StripeBinding;
  WORKSPACE: unknown;
}

export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  const agent = await init({
    sandbox: env.WORKSPACE as never,
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
    const { result, evidence } = await env.STRIPE.refunds.create({
      charge: payload.chargeId,
      amount: decision.amount,
    });
    return { action: 'refunded', stripeId: result.id, evidence };
  }

  return decision;
}
