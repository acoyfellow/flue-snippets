/**
 * alchemy.run.ts — declarative deploy for snippet 01.
 *
 * Run order:
 *   1. `flue build --target cloudflare` produces `.build/dist/_entry.ts`
 *      (the bundled-by-wrangler-downstream module that exports the worker
 *      default + the `LabReceipt` Durable Object class).
 *   2. `bun run alchemy.run.ts` deploys via alchemy:
 *        - one Worker, pointing at _entry.ts
 *        - DO binding for LabReceipt (with the SQLite migration tag)
 *        - vars: LAB_URL, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY
 *      and prints the worker URL on stdout.
 *   3. Caller (run-e2e.sh) reads the URL, runs gateproof against it.
 *   4. `bun run alchemy.run.ts --destroy` tears the worker down.
 *
 * No wrangler. Alchemy is the system of record; flue produces the
 * entrypoint module, alchemy owns the resource graph.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-01-lab-receipt', { stage: STAGE });

const worker = await Worker(`flue-01-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    LabReceipt: DurableObjectNamespace('LabReceipt', {
      className: 'LabReceipt',
      sqlite: true,
    }),
    LAB_URL,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
