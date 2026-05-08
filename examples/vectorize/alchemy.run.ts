/**
 * alchemy.run.ts — vectorize hello world.
 *
 * Workers AI provides the embedding model (`@cf/baai/bge-base-en-v1.5`,
 * 768 dims). Vectorize stores + queries the vectors. The agent does
 * one upsert + one query in a single request.
 */

import alchemy from 'alchemy';
import {
  Ai,
  DurableObjectNamespace,
  VectorizeIndex,
  Worker,
} from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-vectorize', { stage: STAGE });

const index = await VectorizeIndex('Index', {
  name: `flue-ex-vec-${STAGE}`,
  dimensions: 768, // bge-base-en-v1.5
  metric: 'cosine',
});

const worker = await Worker(`flue-ex-vec-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    VECTOR: index,
    Vectorize: DurableObjectNamespace('Vectorize', {
      className: 'Vectorize',
      sqlite: true,
    }),
  },
});

console.log(worker.url);

await app.finalize();
