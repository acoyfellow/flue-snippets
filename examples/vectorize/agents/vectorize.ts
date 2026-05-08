// examples/vectorize — embed text via Workers AI, upsert into Vectorize,
// query top-k. The smallest possible "vector search at the edge."

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  AI: {
    run: (model: string, args: unknown) => Promise<{ data?: number[][] }>;
  };
  VECTOR: {
    upsert: (vectors: Array<{ id: string; values: number[]; metadata?: unknown }>) => Promise<unknown>;
    query: (
      values: number[],
      opts?: { topK?: number; returnMetadata?: boolean | 'all' | 'none' | 'indexed' },
    ) => Promise<{ matches: Array<{ id: string; score: number; metadata?: unknown }> }>;
  };
}

export const triggers = { webhook: true };

async function embed(env: Env, text: string): Promise<number[]> {
  const out = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text });
  return out.data?.[0] ?? [];
}

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  // 1. Embed and upsert one document.
  const docId = `doc-${Date.now()}`;
  const docText = String(payload.docText ?? 'octarine is the colour of magic');
  const docVec = await embed(env, docText);
  await env.VECTOR.upsert([{ id: docId, values: docVec, metadata: { text: docText } }]);

  // 2. Query against the index. With only one doc, it should be the top hit.
  const queryText = String(payload.queryText ?? 'tell me the colour of magic');
  const queryVec = await embed(env, queryText);
  const result = await env.VECTOR.query(queryVec, { topK: 1, returnMetadata: 'all' });

  return {
    docId,
    docText,
    queryText,
    topMatch: result.matches[0] ?? null,
    dimensions: docVec.length,
  };
}
