/**
 * alchemy.run.ts — r2 hello world.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, R2Bucket, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-r2', { stage: STAGE });

const bucket = await R2Bucket('Bucket', { name: `flue-ex-r2-${STAGE}`, empty: true });

const worker = await Worker(`flue-ex-r2-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    BUCKET: bucket,
    R2: DurableObjectNamespace('R2', { className: 'R2', sqlite: true }),
  },
});

console.log(worker.url);

await app.finalize();
