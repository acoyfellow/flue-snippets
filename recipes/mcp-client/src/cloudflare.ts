import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';

export class ReverseServer extends McpAgent<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>
> {
  server = new McpServer({ name: 'flue-rx-mcp-reverser', version: '1.0.0' });

  async init() {
    this.server.tool(
      'reverse_string',
      'Reverse a string character by character. Returns the reversed string as text.',
      { input: z.string().describe('The string to reverse.') },
      async ({ input }: { input: string }) => ({
        content: [{ type: 'text' as const, text: input.split('').reverse().join('') }],
      }),
    );
  }
}
