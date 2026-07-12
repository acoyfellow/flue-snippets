import { type AgentRouteHandler, defineAgent } from '@flue/runtime';

// recipes/do-session — one agent instance per user, persisted across requests,
// restart-safe and geo-pinned, via Cloudflare Durable Objects. Flue handles the
// session store automatically; zero Redis/Postgres/session code.
//
// POST /agents/do-session/<userId> delivers a chat turn into that instance's
// living conversation. Same userId = same DO = same history. Read replies from
// GET /agents/do-session/<userId>?view=history.

export const description = 'Per-user chat agent with durable, restart-safe session memory.';

export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
  instructions:
    'You are a concise chat assistant. Answer in one short sentence and always use the conversation history to recall facts the user told you earlier.',
}));
