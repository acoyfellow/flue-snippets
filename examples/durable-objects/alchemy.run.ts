/**
 * alchemy.run.ts — durable-objects hello world.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-do', { stage: STAGE });

const worker = await Worker(`flue-ex-do-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    DurableObjects: DurableObjectNamespace('DurableObjects', {
      className: 'DurableObjects',
      sqlite: true,
    }),
  },
});

console.log(worker.url);

await app.finalize();
