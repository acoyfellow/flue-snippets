// Register the Cloudflare provider to route through a NAMED AI Gateway
// (caching, observability, retries). User app.ts imports run before Flue's
// auto-registration, so this registration wins. Falls back to a default id.

import { env } from 'cloudflare:workers';
import { registerProvider } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

registerProvider('cloudflare', {
  api: 'cloudflare-ai-binding',
  binding: (env as unknown as { AI: unknown }).AI,
  gateway: {
    id: (env as unknown as { CLOUDFLARE_GATEWAY_ID?: string }).CLOUDFLARE_GATEWAY_ID ?? 'jordan',
    cacheTtl: 3600,
  },
});

const app = new Hono();
app.route('/', flue());
export default app;
