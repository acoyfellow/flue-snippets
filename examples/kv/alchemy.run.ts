/**
 * alchemy.run.ts — kv hello world.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, KVNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-kv', { stage: STAGE });

const kv = await KVNamespace('Kv', { title: `flue-ex-kv-${STAGE}` });

const worker = await Worker(`flue-ex-kv-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    KV: kv,
    Kv: DurableObjectNamespace('Kv', { className: 'Kv', sqlite: true }),
  },
});

console.log(worker.url);

await app.finalize();
