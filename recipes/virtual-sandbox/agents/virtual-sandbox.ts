// recipes/virtual-sandbox — Flue Virtual Sandbox over R2
//
// Mounts an R2 bucket as the agent's virtual filesystem. The agent gets
// bash-like tools (grep, find, read) over the bucket contents without
// spinning up a real container — backed by a DO + SQLite metadata layer
// and R2 blobs under the hood.
//
// Uses Workers AI (llama-4-scout) so this snippet is free-tier-friendly
// and has no third-party vendor key requirement.

import type { FlueContext } from '@flue/sdk/client';
// TODO: confirm `@flue/sdk/cloudflare` is the canonical import path for
// getVirtualSandbox — the Flue homepage demo uses this path.
import { getVirtualSandbox } from '@flue/sdk/cloudflare';

interface Env {
  KB: R2Bucket;
}

export const triggers = { webhook: true };

// POST /agents/virtual-sandbox/<id>
//
// The agent searches /workspace/docs (the mounted R2 bucket) with grep
// and friends, then answers from what it found.
export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  // Mount R2 bucket as a virtual filesystem at /workspace.
  // Backed by DO SQLite metadata + R2 blobs under the hood.
  const sandbox = await getVirtualSandbox(env.KB);

  // Seed the bucket with a known doc on first run so the assertion is
  // deterministic. In production you'd populate R2 separately.
  await env.KB.put('docs/colours.md', '# Colours\n\nOctarine is the colour of magic.\n');
  await env.KB.put('docs/policies.md', '# Policies\n\nAll support requests require ID.\n');

  const agent = await init({
    sandbox,
    model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
  });
  const session = await agent.session();

  const answer = await session.prompt(
    `Answer this question using only what you can grep from /workspace/docs: ${payload.message}`,
  );
  return { answer };
}
