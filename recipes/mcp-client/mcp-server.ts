// recipes/mcp-client/mcp-server.ts, co-hosted MCP server Worker.
//
// This is NOT a Flue agent. It's a raw Cloudflare Worker that uses the
// `agents/mcp` package's McpAgent class to expose one tool over the
// MCP Streamable HTTP transport at /mcp.
//
// We deliberately keep this file at the recipe root (NOT under agents/)
// so the `flue build` pipeline ignores it, flue only scans agents/
// for Flue-style modules. alchemy.run.ts points at this file as a
// separate Worker entrypoint and bundles it directly.
//
// Reference: https://developers.cloudflare.com/agents/api-reference/mcp-agent-api/
//
// Tool exposed:
//   reverse_string(input: string) → { content: [{ type: 'text', text }] }
//
// The implementation is deterministic, no model call, no I/O. The
// recipe asserts the Flue agent (on the other Worker) successfully
// round-trips a string through this tool via MCP.

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// McpAgent's generics are <Env, State, Props>. We have no per-session
// state and no auth props, so they're empty. The DO binding is provided
// by alchemy as `ReverseServer` (the class name below).
export class ReverseServer extends McpAgent<unknown, Record<string, never>, Record<string, never>> {
  server = new McpServer({
    name: 'flue-rx-mcp-reverser',
    version: '1.0.0',
  });

  async init() {
    this.server.tool(
      'reverse_string',
      'Reverse a string character by character. Returns the reversed string as text.',
      { input: z.string().describe('The string to reverse.') },
      async ({ input }) => ({
        content: [
          {
            type: 'text',
            text: input.split('').reverse().join(''),
          },
        ],
      }),
    );
  }
}

// McpAgent.serve(path) returns a Worker handler that routes the MCP
// Streamable HTTP protocol at `path`. It expects a DurableObjectNamespace
// binding whose name matches the class name (`ReverseServer`), which
// alchemy.run.ts declares.
export default ReverseServer.serve('/mcp');
