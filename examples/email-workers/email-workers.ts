// examples/email-workers — send a real email via Cloudflare Email Service.
//
// The Flue agent receives a webhook payload describing something worth
// emailing about (an alert, a digest item, a triage result), uses
// Workers AI to compose a short human-readable body, then sends the
// email through `env.EMAIL.send()` — the Cloudflare Email Service
// Workers binding. No simulation: the call hits the real CF email
// pipeline and returns a `messageId` you can audit.
//
// Prerequisites for this to actually send mail:
//   1. Cloudflare Email Service onboarded for the sender's domain
//      (https://dash.cloudflare.com/?to=/:account/email-service/sending).
//      Onboarding adds the cf-bounce subdomain + SPF/DKIM/DMARC records.
//   2. EMAIL_FROM env var: the verified sender address.
//   3. EMAIL_TO env var: any recipient. Email Service uses an
//      allowlist on the binding (declared in alchemy.run.ts).
//
// Without (1) you'll get an E_SENDER_NOT_VERIFIED. The agent still
// deploys; the assert just won't pass until the domain is onboarded.

import type { FlueContext } from '@flue/sdk/client';

interface SendEmail {
  send(message: {
    to: string | string[];
    from: string | { email: string; name: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
}

interface Env {
  AI: { run: (model: string, args: unknown) => Promise<{ response: string }> };
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  EMAIL_TO: string;
}

interface Payload {
  subject?: string;
  context?: string;
  // Override the binding's recipient at request time. Must be in the
  // allowlist declared on the binding (alchemy.run.ts).
  to?: string;
}

export const triggers = { webhook: true };

// POST /agents/email-workers/<id>
//   body: { subject?: string, context?: string, to?: string }
//
// Behaviour:
//   1. Ask Workers AI to draft a short plain-text body using `context`.
//   2. Call env.EMAIL.send() with the drafted body.
//   3. Return the real Email Service messageId on success, or the
//      structured error code (E_SENDER_NOT_VERIFIED, etc.) on failure.
export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const p = payload as Payload;
  const subject = p.subject ?? 'Flue agent notification';
  const context = p.context ?? 'A test email from the flue-snippets repo.';
  const to = p.to ?? env.EMAIL_TO;

  if (!env.EMAIL_FROM) {
    return { ok: false, code: 'E_MISSING_EMAIL_FROM', error: 'EMAIL_FROM not configured' };
  }
  if (!to) {
    return { ok: false, code: 'E_MISSING_EMAIL_TO', error: 'EMAIL_TO not configured and no payload.to' };
  }

  const ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: `Draft a short, plain-text email body (2-4 sentences, no greeting, no signature) about:\n\n${context}`,
  });
  const text = ai.response.trim();
  const html = `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`;

  try {
    const { messageId } = await env.EMAIL.send({
      to,
      from: env.EMAIL_FROM,
      subject,
      text,
      html,
    });
    return { ok: true, messageId, to, subject };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return {
      ok: false,
      code: e.code ?? 'E_UNKNOWN',
      error: e.message ?? String(err),
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
