/**
 * alchemy.run.ts, declarative deploy for snippet 18 (lab-checkpoint).
 *
 * Flue auto-generates the `LabCheckpoint` Durable Object in _entry.ts.
 * Alchemy declares it + the LAB_URL var so the agent can post receipts.
 *
 * No wrangler. Alchemy is the system of record.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-18-lab-checkpoint', { stage: STAGE });

const worker = await Worker(`flue-18-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    LabCheckpoint: DurableObjectNamespace('LabCheckpoint', {
      className: 'LabCheckpoint',
      sqlite: true,
    }),
    LAB_URL,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
