// examples/queues — agent sends a message to a Queue.
//
// `env.QUEUE.send(...)` enqueues. Cloudflare Queues acks immediately;
// processing happens later in a consumer Worker. This example only
// asserts the producer side (the send). For an end-to-end consumer
// pattern, see Cloudflare's Queues docs on QueueConsumer.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  QUEUE: { send: (msg: unknown, opts?: unknown) => Promise<void> };
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const message = { ts: Date.now(), text: payload.text ?? 'hello queue' };
  await env.QUEUE.send(message);
  return { sent: message, status: 'enqueued' };
}
