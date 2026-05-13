/**
 * alchemy.run.ts, declarative deploy for snippet 11 (gateway-lab).
 *
 * Snippet 06 (gateway) + Lab receipt env. Same harness shape as 01
 * with AI Gateway routing added.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';
// 'jordan' is the personal account's existing AI Gateway. Override
// via CLOUDFLARE_GATEWAY_ID for a different gateway.
const GATEWAY_ID = process.env.CLOUDFLARE_GATEWAY_ID ?? 'jordan';

const app = await alchemy('flue-11-gateway-lab', { stage: STAGE });

const worker = await Worker(`flue-11-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    GatewayLab: DurableObjectNamespace('GatewayLab', {
      className: 'GatewayLab',
      sqlite: true,
    }),
    LAB_URL,
    CLOUDFLARE_GATEWAY_ID: GATEWAY_ID,
  },
});

console.log(worker.url);

await app.finalize();
