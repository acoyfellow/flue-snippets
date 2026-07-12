import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { ReverseServer } from './cloudflare.ts';

// Route the MCP Streamable HTTP protocol at /mcp to the co-hosted MCP server
// Durable Object, and mount Flue (agents/workflows/channels) at root.
const mcpHandler = ReverseServer.serve('/mcp', { binding: 'ReverseServer' });

const app = new Hono();
app.all('/mcp', (c) => mcpHandler.fetch(c.req.raw, c.env as never, c.executionCtx as never));
app.all('/mcp/*', (c) => mcpHandler.fetch(c.req.raw, c.env as never, c.executionCtx as never));
app.route('/', flue());
export default app;
