import { type AgentRouteHandler, defineAgent } from '@flue/runtime';

// examples/durable-objects — per-user agent routing via Durable Objects.
// Flue creates one DO instance per path id: POST /agents/durable-objects/<id>.
// Same id = same DO = same conversation history; a new id = a fresh instance.
// Flue handles the session store automatically on Cloudflare.

export const description = 'Per-instance chat agent demonstrating Durable Object routing.';

export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
  instructions:
    'You are a concise assistant. Answer in one short sentence and use the conversation history to recall anything the user told you earlier.',
}));
