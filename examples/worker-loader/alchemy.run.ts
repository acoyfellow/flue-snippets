/**
 * alchemy.run.ts — worker-loader hello world.
 *
 * The Worker binding `LOADER` is the Worker Loader API. Each call to
 * `env.LOADER.get(id, factory)` returns a child Worker running in its
 * own isolate.
 */

import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker, WorkerLoader } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-worker-loader', { stage: STAGE });

const worker = await Worker(`flue-ex-wl-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    LOADER: WorkerLoader(),
    WorkerLoader: DurableObjectNamespace('WorkerLoader', {
      className: 'WorkerLoader',
      sqlite: true,
    }),
  },
});

console.log(worker.url);

await app.finalize();
