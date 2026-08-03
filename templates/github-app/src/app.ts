import { env } from 'cloudflare:workers';
import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { Hono } from 'hono';
import { channel } from './channels/github.ts';

setProvider(cloudflareBindingProvider({ binding: (env as unknown as { AI: Ai }).AI }));

// The Triage agent is deliberately NOT mounted: registration comes from the
// 'use agent' scan, so the channel can dispatch() to it while it stays
// unreachable over direct HTTP. Only the verified webhook is exposed.
const app = new Hono();

// Defence in depth. @flue/github already verifies the x-hub-signature-256
// HMAC against the raw body and answers 401 on a bad or missing signature;
// this rejects an unsigned request before it reaches the channel at all, so
// the AI binding is never reachable without a GitHub-signed delivery.
app.use('/channels/github/*', async (c, next) => {
	if (!c.req.header('x-hub-signature-256')) {
		return c.json({ error: 'unauthorized' }, 401);
	}
	await next();
});

app.route('/channels/github', channel.route());

export default app;
