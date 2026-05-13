/**
 * alchemy.run.ts, declarative deploy for snippet 06 (ai-gateway).
 *
 * Routes Workers AI prompts through a Cloudflare AI Gateway. The
 * gateway is created lazily by Cloudflare on first request to the
 * gateway URL, no separate API call needed. Just pick a stable name
 * and use it.
 *
 * No wrangler. Alchemy is the system of record.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
// 'jordan' is the personal account's existing AI Gateway. The agent
// uses env.AI.run(..., { gateway: { id } }), which auto-creates if
// missing, but we point at a real one for cleaner test signal.
const GATEWAY_ID = process.env.CLOUDFLARE_GATEWAY_ID ?? 'jordan';

const app = await alchemy('flue-06-ai-gateway', { stage: STAGE });

const worker = await Worker(`flue-06-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    AiGateway: DurableObjectNamespace('AiGateway', {
      className: 'AiGateway',
      sqlite: true,
    }),
    CLOUDFLARE_GATEWAY_ID: GATEWAY_ID,
  },
});

console.log(worker.url);

await app.finalize();
