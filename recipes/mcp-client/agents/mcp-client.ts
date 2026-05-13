// Flue agent that connects to a co-hosted MCP server (deployed by the
// same alchemy.run.ts) and uses its tools mid-prompt. No tool wiring
// on the Flue side, `mcp.tools` is handed to init({ tools }) and the
// model calls them directly.

import { connectMcpServer, type FlueContext } from '@flue/sdk/client';

interface Env {
  // The MCP server's /mcp URL, injected by alchemy.run.ts.
  MCP_URL: string;
}

export const triggers = { webhook: true };

// POST /agents/mcp-client/<id>  body: { text: string }
export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  const text = typeof (payload as { text?: unknown }).text === 'string'
    ? (payload as { text: string }).text
    : 'hello';

  // Default transport is Streamable HTTP, matches McpAgent.serve('/mcp').
  const mcp = await connectMcpServer('reverser', { url: env.MCP_URL });

  try {
    const harness = await init({
      model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
      tools: mcp.tools,
    });
    const session = await harness.session();
    const result = await session.prompt(
      `Use the reverse_string tool to reverse this exact text: "${text}". ` +
        'Reply with only the reversed string, no other text.',
    );
    return { text, reversed: result, mcpUrl: env.MCP_URL };
  } finally {
    await mcp.close();
  }
}
