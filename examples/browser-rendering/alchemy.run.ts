/**
 * alchemy.run.ts — browser-rendering hello world.
 */

import alchemy from 'alchemy';
import {
  BrowserRendering,
  DurableObjectNamespace,
  Worker,
} from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

const app = await alchemy('flue-ex-browser', { stage: STAGE });

const worker = await Worker(`flue-ex-br-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    BROWSER: BrowserRendering(),
    BrowserRendering: DurableObjectNamespace('BrowserRendering', {
      className: 'BrowserRendering',
      sqlite: true,
    }),
  },
});

console.log(worker.url);

await app.finalize();
