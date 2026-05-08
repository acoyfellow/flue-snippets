/**
 * alchemy.run.ts — d1 hello world.
 */

import alchemy from 'alchemy';
import { D1Database, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-d1', { stage: STAGE });

const db = await D1Database('Db', { name: `flue-ex-d1-${STAGE}` });

const worker = await Worker(`flue-ex-d1-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    DB: db,
    D1: DurableObjectNamespace('D1', { className: 'D1', sqlite: true }),
  },
});

console.log(worker.url);

await app.finalize();
