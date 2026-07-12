import { env } from 'cloudflare:workers';
import {
  connectMcpServer,
  defineAgent,
  defineWorkflow,
  type WorkflowRouteHandler,
} from '@flue/runtime';
import * as v from 'valibot';

// recipes/mcp-client — a Flue 1.0 workflow whose agent connects to a co-hosted
// MCP server (src/cloudflare.ts, mounted at /mcp in src/app.ts) and lets the
// model call its reverse_string tool.
//
// The MCP connection happens INSIDE the async defineAgent initializer (which
// runs per-instance in a handler), not at module scope — Cloudflare Workers
// forbid I/O (fetch/connect) in global scope. MCP_URL points at this Worker's
// own /mcp endpoint (injected at deploy as a var).

interface Env {
  MCP_URL: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(async () => {
  const { MCP_URL } = env as unknown as Env;
  const reverser = await connectMcpServer('reverser', { url: MCP_URL });
  return { model: 'cloudflare/@cf/moonshotai/kimi-k2.6', tools: reverser.tools };
});

export default defineWorkflow({
  agent,
  input: v.object({ text: v.optional(v.string()) }),
  output: v.object({ text: v.string(), reversed: v.string(), mcpUrl: v.string() }),
  async run({ harness, input }) {
    const { MCP_URL } = env as unknown as Env;
    const text = input.text ?? 'hello';
    const session = await harness.session();
    const response = await session.prompt(
      `Use the reverse_string tool to reverse this exact text: "${text}". Reply with only the reversed string, no other text.`,
    );
    return { text, reversed: response.text, mcpUrl: MCP_URL };
  },
});
