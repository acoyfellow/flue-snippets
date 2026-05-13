/**
 * alchemy.run.ts — deploy the flue-snippets showcase site.
 *
 * Topology:
 *   - The Astro build emits ./dist (a static SPA, no SSR).
 *   - We wrap it in a tiny Worker (./worker.ts) whose only job is
 *     `return env.ASSETS.fetch(request)`. The `Assets` binding does the
 *     actual asset serving + caching.
 *   - A `CustomDomain` binding attaches the Worker to flue.coey.dev.
 *
 * alchemy auto-infers the zoneId from the hostname (looks up coey.dev
 * in the authenticated account). No zoneId hardcoded here.
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN   — Workers Scripts:Edit + Zone:Edit (for coey.dev)
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Optional env:
 *   STAGE                  — staging-vs-prod separator, default "prod"
 *   SITE_HOSTNAME          — override the default hostname for previews
 */

import alchemy from 'alchemy';
import { Assets, CustomDomain, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'prod';
const HOSTNAME = process.env.SITE_HOSTNAME ?? 'flue.coey.dev';

const app = await alchemy('flue-snippets-site', { stage: STAGE });

const assets = await Assets({ path: './dist' });

const worker = await Worker(`flue-snippets-site-${STAGE}`, {
  entrypoint: './worker.ts',
  compatibilityDate: '2026-04-23',
  compatibility: 'node',
  // adopt: take ownership of an existing Worker by this name if one
  // is already deployed (e.g. from a previous CI run). Without this,
  // alchemy on a fresh runner has no local state and fails the second
  // deploy with a name collision.
  adopt: true,
  bindings: {
    ASSETS: assets,
  },
});

// Only attach the custom domain on the prod stage.
// Previews live on the *.workers.dev URL printed below.
if (STAGE === 'prod') {
  await CustomDomain('flue-snippets-domain', {
    name: HOSTNAME,
    workerName: worker.name,
    adopt: true, // tolerate an existing binding without failing
  });
}

console.log(worker.url);
if (STAGE === 'prod') console.log(`https://${HOSTNAME}`);

await app.finalize();
