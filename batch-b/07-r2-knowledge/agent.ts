// batch-b/07-r2-knowledge — Flue + R2 + getVirtualSandbox
//
// A support agent whose entire knowledge base is an R2 bucket, mounted as
// the agent's filesystem. The agent searches with bash (grep, glob, read)
// — no vector DB, no embedding pipeline, no chunking. Just files.

import type { FlueContext } from '@flue/sdk/client';
import { getVirtualSandbox } from '@flue/sdk/cloudflare';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  // R2 bucket mounted at /workspace, backed by DO SQLite + R2.
  // Drop a markdown file in via wrangler; agent picks it up next request.
  const sandbox = await getVirtualSandbox(env.KNOWLEDGE_BASE);

  const agent = await init({
    sandbox,
    model: 'openrouter/moonshotai/kimi-k2.6',
    role: 'support-agent',
  });
  const session = await agent.session();

  return await session.prompt(
    `Search the knowledge base for articles relevant to this request, ` +
    `then write a helpful response. Customer: ${payload.message}`
  );
}
