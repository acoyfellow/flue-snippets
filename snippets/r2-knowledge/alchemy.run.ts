/**
 * alchemy.run.ts — declarative deploy for snippet 07 (r2-knowledge).
 *
 * Resources:
 *   - R2Bucket             flue-07-kb-<stage>: the agent's filesystem
 *   - R2Object * 1         seeds the bucket with refunds.md so the
 *                          agent has something to grep for in tests
 *   - DurableObjectNamespace  R2Knowledge agent DO (workspace index in SQLite)
 *   - Worker               the deployed Flue agent
 *
 * Destroying the stack tears down the bucket too, so seeded test
 * objects don't accumulate.
 */

import alchemy from 'alchemy';
import {
  DurableObjectNamespace,
  R2Bucket,
  R2Object,
  Worker,
} from 'alchemy/cloudflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-07-r2-knowledge', { stage: STAGE });

const knowledgeBase = await R2Bucket('KnowledgeBase', {
  name: `flue-07-kb-${STAGE}`,
  empty: true,
});

// Seed the bucket with one markdown file so the agent has something to
// grep for. The fixture path is relative to alchemy.run.ts.
await R2Object('SeedRefunds', {
  bucket: knowledgeBase,
  key: 'refunds.md',
  content: readFileSync(resolve('fixtures', 'refunds.md'), 'utf8'),
  contentType: 'text/markdown',
});

const worker = await Worker(`flue-07-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    KNOWLEDGE_BASE: knowledgeBase,
    R2Knowledge: DurableObjectNamespace('R2Knowledge', {
      className: 'R2Knowledge',
      sqlite: true,
    }),
    // pi-ai's cloudflare-workers-ai provider hits Workers AI over HTTP
    // and reads these from env (not the Worker AI binding).
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
