// Send a real email via Cloudflare Email Service. AI drafts the body,
// env.EMAIL.send() hits the real pipeline and returns a messageId.
// Requires the sender domain to be onboarded in the CF dashboard:
// https://dash.cloudflare.com/?to=/:account/email-service/sending

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
  to?: string; // override binding's recipient (must be on the allowlist)
}

export const triggers = { webhook: true };

// POST /agents/email-workers/<id>  body: { subject?, context?, to? }
export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const p = payload as Payload;
  const subject = p.subject ?? 'Flue agent notification';
  const context = p.context ?? 'A test email from the flue-snippets repo.';
  const to = p.to ?? env.EMAIL_TO;

  if (!env.EMAIL_FROM) return { ok: false, code: 'E_MISSING_EMAIL_FROM' };
  if (!to) return { ok: false, code: 'E_MISSING_EMAIL_TO' };

  const ai = await env.AI.run('@cf/moonshotai/kimi-k2.6', {
    prompt: `Draft a short plain-text email body (2-4 sentences, no greeting or signature) about:\n\n${context}`,
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
    return { ok: false, code: e.code ?? 'E_UNKNOWN', error: e.message ?? String(err) };
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
