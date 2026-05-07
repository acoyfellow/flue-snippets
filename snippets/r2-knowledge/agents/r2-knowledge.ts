// batch-b/07-r2-knowledge — Flue + R2 + getVirtualSandbox
//
// A support agent whose entire knowledge base is an R2 bucket, mounted
// as the agent's filesystem at /workspace. The agent searches with bash
// (grep, glob, read) — no embeddings, no vector DB, no chunking. Just
// markdown files.
//
// Drop a file in via wrangler/alchemy/CF API; the agent finds it on the
// next request. Workspace index is stored in DO SQLite alongside the
// agent's session.

import type { FlueContext } from '@flue/sdk/client';
import { getVirtualSandbox } from '@flue/sdk/cloudflare';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const sandbox = await getVirtualSandbox(env.KNOWLEDGE_BASE);

  const agent = await init({
    sandbox,
    model: 'cloudflare-workers-ai/@cf/google/gemma-4-26b-a4b-it',
  });
  const session = await agent.session();

  const answer = await session.prompt(
    `Search the knowledge base under /workspace using bash (grep, ls, ` +
    `cat). Use only what you find. Customer message: ${payload.message}`,
  );

  return { answer };
}
