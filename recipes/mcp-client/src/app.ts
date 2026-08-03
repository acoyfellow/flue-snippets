import { env } from 'cloudflare:workers';
import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { McpClient } from './agents/mcp-client.ts';
import { ReverseServer } from './cloudflare.ts';

setProvider(cloudflareBindingProvider({ binding: (env as unknown as { AI: Ai }).AI }));

const mcpHandler = ReverseServer.serve('/mcp', { binding: 'ReverseServer' });
const app = new Hono();

// This Worker holds an AI binding and is reachable on a public workers.dev
// URL, so every agent route is gated on a shared secret. Without this an
// anonymous caller could drive your Workers AI account. SNIPPET_API_KEY is
// injected at deploy time by run-e2e.sh.
app.use('/agents/*', async (c, next) => {
	const expected = (env as unknown as { SNIPPET_API_KEY?: string }).SNIPPET_API_KEY;
	if (!expected || c.req.header('x-api-key') !== expected) {
		return c.json({ error: 'unauthorized' }, 401);
	}
	await next();
});

app.all('/mcp', (context) =>
  mcpHandler.fetch(context.req.raw, context.env as never, context.executionCtx as never),
);
app.all('/mcp/*', (context) =>
  mcpHandler.fetch(context.req.raw, context.env as never, context.executionCtx as never),
);
app.route('/agents/mcp-client', createAgentRouter(McpClient));

export default app;
