/**
 * alchemy.run.ts, declarative deploy for snippet 08 (do-session).
 *
 * Flue auto-generates a `DoSession` Durable Object class (one DO per
 * agent). Alchemy declares it as a SQLite-backed namespace so each user
 * (path id) gets a durable, geo-pinned conversation store.
 *
 * No wrangler. `alchemy deploy` owns the resource graph;
 * `alchemy destroy` tears it down.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';

const app = await alchemy('flue-08-do-session', { stage: STAGE });

const worker = await Worker(`flue-08-${STAGE}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    DoSession: DurableObjectNamespace('DoSession', {
      className: 'DoSession',
      sqlite: true,
    }),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
