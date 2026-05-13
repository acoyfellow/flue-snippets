/**
 * alchemy.run.ts, declarative deploy for the github-triage recipe.
 *
 * Flue auto-generates a `GithubTriage` Durable Object class (one DO
 * per agent). Alchemy declares it as a SQLite-backed namespace so the
 * webhook-triggered agent has durable, geo-pinned state if it ever
 * needs to fan out work across requests.
 *
 * The production wiring (a real GitHub App) would also bind a
 * `GITHUB_TOKEN` secret and verify the webhook signature. The snippet
 * accepts the issue body inline so the E2E doesn't need a live repo.
 *
 * No wrangler. `alchemy deploy` owns the resource graph;
 * `alchemy destroy` tears it down.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';

const app = await alchemy('flue-rx-github-triage', { stage: STAGE });

const worker = await Worker(`flue-rx-gt-${STAGE}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    GithubTriage: DurableObjectNamespace('GithubTriage', {
      className: 'GithubTriage',
      sqlite: true,
    }),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
