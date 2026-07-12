import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/queues — send a message to a Queue (producer side). Flue 1.0 workflow.
// Cloudflare Queues acks immediately; processing happens later in a consumer.

interface Env {
  QUEUE: { send: (msg: unknown, opts?: unknown) => Promise<void> };
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ text: v.optional(v.string()) }),
  output: v.object({ status: v.string(), text: v.string() }),
  async run({ input }) {
    const { QUEUE } = env as unknown as Env;
    const text = input.text ?? 'hello queue';
    await QUEUE.send({ ts: Date.now(), text });
    return { status: 'enqueued', text };
  },
});
