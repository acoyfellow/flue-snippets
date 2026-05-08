/**
 * alchemy.run.ts — workers-ai hello world.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-workers-ai', { stage: STAGE });

const worker = await Worker(`flue-ex-wai-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    WorkersAi: DurableObjectNamespace('WorkersAi', {
      className: 'WorkersAi',
      sqlite: true,
    }),
  },
});

console.log(worker.url);

await app.finalize();
