import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/r2 — write an object, read it back. Flue 1.0 workflow.

interface Env {
  BUCKET: R2Bucket;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ key: v.string(), body: v.string() }),
  output: v.object({ key: v.string(), read: v.string(), match: v.boolean() }),
  async run({ input }) {
    const { BUCKET } = env as unknown as Env;
    await BUCKET.put(input.key, input.body);
    const obj = await BUCKET.get(input.key);
    const read = obj ? await obj.text() : '';
    return { key: input.key, read, match: read === input.body };
  },
});
