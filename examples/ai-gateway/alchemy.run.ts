/**
 * alchemy.run.ts — ai-gateway hello world.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
const GATEWAY_ID = process.env.CLOUDFLARE_GATEWAY_ID ?? 'jordan';

const app = await alchemy('flue-ex-ai-gateway', { stage: STAGE });

const worker = await Worker(`flue-ex-aigw-${SHA}`, {
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
