/**
 * alchemy.run.ts, deploy for templates/github-app.
 *
 * The webhook agent is exported by `agents/webhook.ts`. Flue's build
 * pipeline auto-generates the Webhook DO. We add a `Triage` DO too in
 * case the webhook spawns a triage subagent, Flue creates one per
 * agent file referenced.
 *
 * Secrets:
 *   GITHUB_WEBHOOK_SECRET, required for HMAC verification. Set via
 *     `wrangler secret put` in prod, or via env when running e2e.
 *   GITHUB_TOKEN, installation access token for the GH App. Leave
 *     empty in the e2e (the agent skips the comment post when empty).
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';

const app = await alchemy('flue-tpl-github-app', { stage: STAGE });

const worker = await Worker(`flue-tpl-ghapp-${STAGE}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    Webhook: DurableObjectNamespace('Webhook', {
      className: 'Webhook',
      sqlite: true,
    }),
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret-rotate-me',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
  },
});

console.log(worker.url);

await app.finalize();
