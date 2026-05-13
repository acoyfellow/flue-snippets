// Mount an R2 bucket as the agent's virtual filesystem. The agent gets
// grep/find/read over the bucket contents, DO SQLite handles metadata,
// R2 holds the blobs. No container, no vector DB, no embedding step.

import type { FlueContext } from '@flue/sdk/client';
import { getVirtualSandbox } from '@flue/sdk/cloudflare';

interface Env {
  KB: R2Bucket;
}

export const triggers = { webhook: true };

// POST /agents/virtual-sandbox/<id>
export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  const sandbox = await getVirtualSandbox(env.KB);

  // Seed two docs so the E2E assertion is deterministic. In production
  // you'd populate R2 separately.
  await env.KB.put('docs/colours.md', '# Colours\n\nOctarine is the colour of magic.\n');
  await env.KB.put('docs/policies.md', '# Policies\n\nAll support requests require ID.\n');

  const agent = await init({
    sandbox,
    model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
  });
  const session = await agent.session();

  const answer = await session.prompt(
    `Answer this question using only what you can grep from /workspace/docs: ${payload.message}`,
  );
  return { answer };
}
