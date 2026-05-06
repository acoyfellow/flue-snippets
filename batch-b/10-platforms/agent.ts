// batch-b/10-platforms — Flue + Workers for Platforms
//
// A multi-tenant Flue host: each tenant uploads their own Flue agent,
// it deploys as an isolated child worker, with its own R2 bucket and
// capability set. You become a platform for Flue agents.

import type { FlueContext } from '@flue/sdk/client';

// The dispatcher: routes by subdomain to a per-tenant worker.
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const tenantId = url.hostname.split('.')[0];  // alice.agents.example.com

    // Each tenant has their own Flue agent code, uploaded via the
    // platform API below. Workers for Platforms isolates them at V8.
    const tenantWorker = env.TENANT_DISPATCHER.get(tenantId);
    if (!tenantWorker) return new Response('tenant not found', { status: 404 });

    return await tenantWorker.fetch(req);
  },

  // Platform admin: register a new tenant + their Flue agent code.
  async register(name: string, agentCode: string, env: Env) {
    await env.TENANT_DISPATCHER.namespace.put(name, agentCode, {
      bindings: [
        { name: 'WORKSPACE', type: 'r2_bucket', bucket_name: `tenant-${name}` },
        { name: 'AI', type: 'ai' },
      ],
    });
  },
};

interface Env { TENANT_DISPATCHER: { get(name: string): any; namespace: any } }
