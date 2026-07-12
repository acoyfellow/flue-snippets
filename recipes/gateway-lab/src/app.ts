import { env } from 'cloudflare:workers';
import { registerProvider } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

// Route Workers AI through a named AI Gateway (observability plane #1).
registerProvider('cloudflare', {
  api: 'cloudflare-ai-binding',
  binding: (env as unknown as { AI: unknown }).AI,
  gateway: {
    id: (env as unknown as { CLOUDFLARE_GATEWAY_ID?: string }).CLOUDFLARE_GATEWAY_ID ?? 'jordan',
  },
});

const app = new Hono();
app.route('/', flue());
export default app;
