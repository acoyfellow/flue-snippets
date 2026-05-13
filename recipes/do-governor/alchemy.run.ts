/**
 * alchemy.run.ts, declarative deploy for snippet 16 (do-governor).
 *
 * Flue auto-generates the `DoGovernor` Durable Object in _entry.ts (one
 * DO per agent file). Alchemy declares it as a SQLite-backed namespace
 * so the governor's run state is durable across requests.
 *
 * No wrangler. Alchemy is the system of record.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-16-do-governor', { stage: STAGE });

const worker = await Worker(`flue-16-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    DoGovernor: DurableObjectNamespace('DoGovernor', {
      className: 'DoGovernor',
      sqlite: true,
    }),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
