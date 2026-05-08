/**
 * alchemy.run.ts — queues hello world.
 *
 * Producer-only. The Queue resource is created and bound to the worker.
 * Cloudflare Queues acks the send synchronously; the consumer side is
 * not part of this hello-world (would need a separate Worker file +
 * QueueConsumer resource binding it).
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Queue, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-queues', { stage: STAGE });

const q = await Queue('Q', { name: `flue-ex-q-${STAGE}` });

const worker = await Worker(`flue-ex-q-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    QUEUE: q,
    Queues: DurableObjectNamespace('Queues', { className: 'Queues', sqlite: true }),
  },
});

console.log(worker.url);

await app.finalize();
