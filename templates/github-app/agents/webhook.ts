// templates/github-app/agents/webhook.ts — main entry.
//
// Receives a GitHub App webhook delivery, verifies the HMAC-SHA256
// signature, then routes by X-GitHub-Event:
//   - issues.opened       → triage skill, post comment
//   - pull_request.opened → pr-review skill, post comment
//   - anything else       → ignored
//
// TODO: Flue's FlueContext currently surfaces `payload` (parsed JSON) +
// `env` but not the raw `Request` object. HMAC verification needs the
// *raw bytes* of the body (or at minimum a byte-stable serialization of
// the parsed object — JSON.stringify is NOT byte-stable across senders).
// Until Flue exposes the raw request, this template verifies against
// `JSON.stringify(payload)`. That works in our gateproof probe (the
// probe controls the serialization), but in production against real
// GitHub webhooks you should either:
//   (a) export a custom Worker fetch handler that reads request.text(),
//       verifies, then dispatches to the Flue agent, OR
//   (b) wait for FlueContext to expose request.
// See https://flueframework.com for current API surface.

import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';
import { postIssueComment } from '../lib/github';
import { verifySignature } from '../lib/verify-signature';

interface Env {
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  AI: unknown;
}

interface IssueWebhook {
  action?: string;
  issue?: {
    number?: number;
    title?: string;
    body?: string | null;
  };
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
  };
  repository?: {
    name?: string;
    owner?: { login?: string };
  };
}

export const triggers = { webhook: true };

const triageSchema = v.object({
  severity: v.picklist(['low', 'medium', 'high', 'critical']),
  reproducible: v.boolean(),
  summary: v.string(),
});

const prReviewSchema = v.object({
  risk: v.picklist(['low', 'medium', 'high']),
  summary: v.string(),
  suggestedReviewers: v.array(v.string()),
});

interface WebhookHeaders {
  signature?: string;
  event?: string;
}

// POST /agents/webhook/<id>
//
// `payload` is the parsed JSON webhook body. Header info is forwarded
// inside payload._headers by the probe and the production GitHub App
// proxy (see README "Production wiring").
export default async function ({
  init,
  payload,
  env,
}: FlueContext & { env: Env }) {
  const headers = (payload as { _headers?: WebhookHeaders })._headers ?? {};
  const signature = headers.signature;
  const event = headers.event;

  // Build the canonical body for HMAC: payload minus the _headers shim.
  const bodyForHmac = { ...(payload as Record<string, unknown>) };
  delete bodyForHmac._headers;
  const rawBody = JSON.stringify(bodyForHmac);

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }
  if (!(await verifySignature(env.GITHUB_WEBHOOK_SECRET, rawBody, signature))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const hook = bodyForHmac as IssueWebhook;
  const repo = hook.repository?.name;
  const owner = hook.repository?.owner?.login;

  if (event === 'issues' && hook.action === 'opened' && hook.issue) {
    const agent = await init({
      model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
    });
    const session = await agent.session();
    const { data } = await session.skill('triage', {
      args: {
        issueTitle: hook.issue.title ?? '',
        issueBody: hook.issue.body ?? '',
        issueNumber: hook.issue.number ?? 0,
      },
      schema: triageSchema,
    });

    // Post the triage comment back. Skipped if GITHUB_TOKEN is empty
    // (the E2E runs without one).
    if (env.GITHUB_TOKEN && owner && repo && hook.issue.number) {
      const body = [
        `**Severity:** ${data.severity}`,
        `**Reproducible:** ${data.reproducible}`,
        '',
        data.summary,
      ].join('\n');
      await postIssueComment(env.GITHUB_TOKEN, owner, repo, hook.issue.number, body);
    }

    return { handled: 'issues.opened', triage: data };
  }

  if (event === 'pull_request' && hook.action === 'opened' && hook.pull_request) {
    const agent = await init({
      model: 'cloudflare-workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct',
    });
    const session = await agent.session();
    const { data } = await session.skill('pr-review', {
      args: {
        prTitle: hook.pull_request.title ?? '',
        prBody: hook.pull_request.body ?? '',
        prNumber: hook.pull_request.number ?? 0,
      },
      schema: prReviewSchema,
    });

    return { handled: 'pull_request.opened', review: data };
  }

  return {
    handled: 'ignored',
    event: event ?? null,
    action: hook.action ?? null,
  };
}
