import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/vectorize — embed text via Workers AI, upsert into Vectorize,
// query top-k. Flue 1.0 workflow. Uses the AI + Vectorize bindings directly
// (no model conversation); the workflow agent is minimal.

interface Env {
  AI: { run: (model: string, args: unknown) => Promise<{ data?: number[][] }> };
  VECTOR: {
    upsert: (
      vectors: Array<{ id: string; values: number[]; metadata?: unknown }>,
    ) => Promise<unknown>;
    query: (
      values: number[],
      opts?: { topK?: number; returnMetadata?: boolean | 'all' | 'none' | 'indexed' },
    ) => Promise<{ matches: Array<{ id: string; score: number; metadata?: unknown }> }>;
  };
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

async function embed(text: string): Promise<number[]> {
  const { AI } = env as unknown as Env;
  const out = await AI.run('@cf/baai/bge-base-en-v1.5', { text });
  return out.data?.[0] ?? [];
}

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ docText: v.optional(v.string()), queryText: v.optional(v.string()) }),
  output: v.object({
    docId: v.string(),
    dimensions: v.number(),
    topMatch: v.nullable(
      v.object({ id: v.string(), score: v.number(), metadata: v.optional(v.unknown()) }),
    ),
  }),
  async run({ input }) {
    const { VECTOR } = env as unknown as Env;
    const docId = `doc-${Date.now()}`;
    const docText = input.docText ?? 'octarine is the colour of magic';
    const docVec = await embed(docText);
    await VECTOR.upsert([{ id: docId, values: docVec, metadata: { text: docText } }]);
    const queryVec = await embed(input.queryText ?? 'tell me the colour of magic');
    const result = await VECTOR.query(queryVec, { topK: 1, returnMetadata: 'all' });
    return { docId, dimensions: docVec.length, topMatch: result.matches[0] ?? null };
  },
});
