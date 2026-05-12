/**
 * alchemy.run.ts — declarative deploy for the virtual-sandbox recipe.
 *
 * Flue's virtual sandbox mounts an R2 bucket as the agent's filesystem.
 * Alchemy declares:
 *   - an R2 bucket (the backing store for /workspace blobs)
 *   - an Ai() binding (Workers AI for the model)
 *   - a SQLite-backed DO namespace (Flue uses it for sandbox metadata
 *     and per-agent session state)
 *
 * No wrangler. `alchemy deploy` owns the resource graph;
 * `alchemy destroy` tears it down. R2 bucket is created `empty: true`
 * so each stage gets a clean slate.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, R2Bucket, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';

const app = await alchemy('flue-rx-virtual-sandbox', { stage: STAGE });

const worker = await Worker(`flue-rx-vs-${STAGE}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    KB: await R2Bucket('Kb', { name: `flue-rx-vs-${STAGE}`, empty: true }),
    AI: Ai(),
    VirtualSandbox: DurableObjectNamespace('VirtualSandbox', {
      className: 'VirtualSandbox',
      sqlite: true,
    }),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
