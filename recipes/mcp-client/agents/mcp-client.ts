// recipes/mcp-client — Flue agent consumes a remote MCP server's tools
//
// Connects to a co-hosted MCP server (deployed alongside this Worker by
// the same alchemy.run.ts), pulls its `tools` list, and hands them to
// init({ tools }). The model can then call `reverse_string` mid-prompt
// over MCP — no hand-written tool wiring on the Flue side.
//
// This proves Flue can wire any MCP server as agent tools, regardless
// of whether the server runs locally, on a different Worker, or on a
// third-party host. We use a co-hosted server here so the recipe has
// no external dependency.
//
// Uses Workers AI (llama-4-scout) so the snippet is free-tier-friendly
// and has no third-party vendor key requirement.

import { connectMcpServer, type FlueContext } from '@flue/sdk/client';

interface Env {
  // Full URL of the co-hosted MCP server's /mcp endpoint, injected by
  // alchemy.run.ts from the server Worker's deployed URL.
  MCP_URL: string;
}

interface ClientPayload {
  text?: unknown;
}

export const triggers = { webhook: true };

// POST /agents/mcp-client/<id>
//   body: { text: string }
//
// Asks a Workers AI model to reverse `text` by calling the co-hosted
// MCP server's `reverse_string` tool. Returns both the input and the
// model's reply so the probe can assert the round-trip.
export default async function ({ init, payload, env }: FlueContext & { env: Env }) {
  const p = payload as ClientPayload;
  const text = typeof p.text === 'string' ? p.text : 'hello';

  // connectMcpServer defaults to Streamable HTTP transport, which is
  // what McpAgent.serve('/mcp') exposes on the server side. No headers
  // needed — the server is authless.
  const mcp = await connectMcpServer('reverser', {
    url: env.MCP_URL,
  });

  try {
    const harness = await init({
      model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
      tools: mcp.tools,
    });
    const session = await harness.session();

    // Prompt is intentionally explicit. The model has only one tool
    // (`reverse_string`) so tool-use is the easy path; we just want
    // it to call the tool and parrot the result back.
    const result = await session.prompt(
      `Use the reverse_string tool to reverse this exact text: "${text}". ` +
        'Reply with only the reversed string, no other text.',
    );

    return { text, reversed: result, mcpUrl: env.MCP_URL };
  } finally {
    // Always close the MCP transport, even if init/prompt threw.
    await mcp.close();
  }
}
