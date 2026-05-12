import alchemy from 'alchemy';
import {
  Ai,
  BrowserRendering,
  D1Database,
  DurableObjectNamespace,
  EmailSender,
  Hyperdrive,
  KVNamespace,
  Queue,
  R2Bucket,
  VectorizeIndex,
  Worker,
  WorkerLoader,
} from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';
const SHA = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
const EXAMPLE = process.env.FLUE_EXAMPLE ?? process.env.EXAMPLE;

if (!EXAMPLE) throw new Error('Set FLUE_EXAMPLE (for example: kv)');

const examples = {
  'ai-gateway': async () => ({
    app: 'flue-ex-ai-gateway',
    worker: 'flue-ex-aigw',
    bindings: {
      AI: Ai(),
      AiGateway: DurableObjectNamespace('AiGateway', { className: 'AiGateway', sqlite: true }),
      CLOUDFLARE_GATEWAY_ID: process.env.CLOUDFLARE_GATEWAY_ID ?? 'jordan',
    },
  }),
  'browser-rendering': async () => ({
    app: 'flue-ex-browser',
    worker: 'flue-ex-br',
    bindings: {
      BROWSER: BrowserRendering(),
      BrowserRendering: DurableObjectNamespace('BrowserRendering', {
        className: 'BrowserRendering',
        sqlite: true,
      }),
    },
  }),
  d1: async () => ({
    app: 'flue-ex-d1',
    worker: 'flue-ex-d1',
    bindings: {
      DB: await D1Database('Db', { name: `flue-ex-d1-${STAGE}` }),
      D1: DurableObjectNamespace('D1', { className: 'D1', sqlite: true }),
    },
  }),
  'durable-objects': async () => ({
    app: 'flue-ex-do',
    worker: 'flue-ex-do',
    bindings: {
      DurableObjects: DurableObjectNamespace('DurableObjects', {
        className: 'DurableObjects',
        sqlite: true,
      }),
    },
  }),
  'email-workers': async () => {
    // EMAIL_TO is the only address the binding is allowed to deliver
    // to. EMAIL_FROM must be a verified sender on a Cloudflare-onboarded
    // domain (see https://dash.cloudflare.com/?to=/:account/email-service/sending).
    // If unset, deploy still succeeds; the runtime returns E_MISSING_*.
    const allowedTo = process.env.EMAIL_TO ? [process.env.EMAIL_TO] : [];
    const allowedFrom = process.env.EMAIL_FROM ? [process.env.EMAIL_FROM] : [];
    return {
      app: 'flue-ex-email-workers',
      worker: 'flue-ex-email',
      bindings: {
        AI: Ai(),
        EMAIL: EmailSender({
          allowedDestinationAddresses: allowedTo,
          allowedSenderAddresses: allowedFrom,
        }),
        EMAIL_FROM: process.env.EMAIL_FROM ?? '',
        EMAIL_TO: process.env.EMAIL_TO ?? '',
        EmailWorkers: DurableObjectNamespace('EmailWorkers', {
          className: 'EmailWorkers',
          sqlite: true,
        }),
      },
    };
  },
  hyperdrive: async () => ({
    app: 'flue-ex-hyperdrive',
    worker: 'flue-ex-hd',
    bindings: {
      // TODO: confirm `Hyperdrive` is the correct alchemy/cloudflare export
      // name and that its option key is `origin` (vs. `connectionString` /
      // `origin.connectionString`). The Cloudflare API field is
      // `origin.connection_string`.
      HYPERDRIVE: await Hyperdrive(`Hd-${STAGE}`, {
        name: `flue-ex-hd-${STAGE}`,
        origin:
          process.env.HYPERDRIVE_CONNECTION_STRING ??
          'postgres://placeholder:placeholder@localhost:5432/placeholder',
      } as never),
      Hyperdrive: DurableObjectNamespace('Hyperdrive', {
        className: 'Hyperdrive',
        sqlite: true,
      }),
    },
  }),
  kv: async () => ({
    app: 'flue-ex-kv',
    worker: 'flue-ex-kv',
    bindings: {
      KV: await KVNamespace('Kv', { title: `flue-ex-kv-${STAGE}` }),
      Kv: DurableObjectNamespace('Kv', { className: 'Kv', sqlite: true }),
    },
  }),
  queues: async () => ({
    app: 'flue-ex-queues',
    worker: 'flue-ex-q',
    bindings: {
      QUEUE: await Queue('Q', { name: `flue-ex-q-${STAGE}` }),
      Queues: DurableObjectNamespace('Queues', { className: 'Queues', sqlite: true }),
    },
  }),
  r2: async () => ({
    app: 'flue-ex-r2',
    worker: 'flue-ex-r2',
    bindings: {
      BUCKET: await R2Bucket('Bucket', { name: `flue-ex-r2-${STAGE}`, empty: true }),
      R2: DurableObjectNamespace('R2', { className: 'R2', sqlite: true }),
    },
  }),
  vectorize: async () => ({
    app: 'flue-ex-vectorize',
    worker: 'flue-ex-vec',
    bindings: {
      AI: Ai(),
      VECTOR: await VectorizeIndex('Index', {
        name: `flue-ex-vec-${STAGE}`,
        dimensions: 768,
        metric: 'cosine',
      }),
      Vectorize: DurableObjectNamespace('Vectorize', { className: 'Vectorize', sqlite: true }),
    },
  }),
  'worker-loader': async () => ({
    app: 'flue-ex-worker-loader',
    worker: 'flue-ex-wl',
    bindings: {
      LOADER: WorkerLoader(),
      WorkerLoader: DurableObjectNamespace('WorkerLoader', {
        className: 'WorkerLoader',
        sqlite: true,
      }),
    },
  }),
  'workers-ai': async () => ({
    app: 'flue-ex-workers-ai',
    worker: 'flue-ex-wai',
    bindings: {
      AI: Ai(),
      WorkersAi: DurableObjectNamespace('WorkersAi', { className: 'WorkersAi', sqlite: true }),
    },
  }),
} satisfies Record<
  string,
  () => Promise<{ app: string; worker: string; bindings: Record<string, unknown> }>
>;

const config = examples[EXAMPLE];
if (!config)
  throw new Error(`Unknown example: ${EXAMPLE}. Options: ${Object.keys(examples).join(', ')}`);

const configMeta: Record<string, { app: string; worker: string }> = {
  'ai-gateway': { app: 'flue-ex-ai-gateway', worker: 'flue-ex-aigw' },
  'browser-rendering': { app: 'flue-ex-browser', worker: 'flue-ex-br' },
  d1: { app: 'flue-ex-d1', worker: 'flue-ex-d1' },
  'durable-objects': { app: 'flue-ex-do', worker: 'flue-ex-do' },
  'email-workers': { app: 'flue-ex-email-workers', worker: 'flue-ex-email' },
  hyperdrive: { app: 'flue-ex-hyperdrive', worker: 'flue-ex-hd' },
  kv: { app: 'flue-ex-kv', worker: 'flue-ex-kv' },
  queues: { app: 'flue-ex-queues', worker: 'flue-ex-q' },
  r2: { app: 'flue-ex-r2', worker: 'flue-ex-r2' },
  vectorize: { app: 'flue-ex-vectorize', worker: 'flue-ex-vec' },
  'worker-loader': { app: 'flue-ex-worker-loader', worker: 'flue-ex-wl' },
  'workers-ai': { app: 'flue-ex-workers-ai', worker: 'flue-ex-wai' },
};

const app = await alchemy(configMeta[EXAMPLE].app, { stage: STAGE });
const { worker: workerName, bindings } = await config();
const worker = await Worker(`${workerName}-${SHA}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings,
});

console.log(worker.url);
await app.finalize();
