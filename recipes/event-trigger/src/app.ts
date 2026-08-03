import { env } from 'cloudflare:workers';
import { dispatch, setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { EventTrigger } from './agents/event-trigger.ts';
import { verifySignature } from './lib/verify-signature.ts';

type RuntimeEnv = { AI: Ai; EVENT_HMAC_SECRET: string };

setProvider(cloudflareBindingProvider({ binding: (env as unknown as RuntimeEnv).AI }));

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


app.post('/events/:source/:conversationId', async (context) => {
  const rawBody = await context.req.text();
  const runtime = env as unknown as RuntimeEnv;
  const signature = context.req.header('x-event-signature') ?? '';
  if (!(await verifySignature(runtime.EVENT_HMAC_SECRET, rawBody, signature))) {
    return context.json({ ok: false, error: 'invalid_signature' }, 401);
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return context.json({ ok: false, error: 'invalid_json' }, 400);
  }

  await dispatch(EventTrigger, {
    id: context.req.param('conversationId'),
    message: {
      kind: 'user',
      body: JSON.stringify({ source: context.req.param('source'), event }),
    },
  });
  return context.json({ accepted: true }, 202);
});

app.route('/agents/event-trigger', createAgentRouter(EventTrigger));

export default app;
