import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

interface Env {
  KV: KVNamespace;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
}));

export default defineWorkflow({
  agent,
  input: v.object({ key: v.string(), value: v.string() }),
  output: v.object({ key: v.string(), read: v.string(), match: v.boolean() }),
  async run({ input }) {
    const { KV } = env as unknown as Env;
    await KV.put(input.key, input.value);
    const read = await KV.get(input.key);
    return { key: input.key, read: read ?? '', match: read === input.value };
  },
});
