import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/email-workers — Cloudflare Email Service. session.prompt drafts the
// body; env.EMAIL.send() hits the real pipeline. Flue 1.0 workflow.
//
// Requires the sender domain to be onboarded + EMAIL_FROM/EMAIL_TO vars set.
// When unset (the key-free E2E), the workflow returns a structured E_* code
// instead of sending — both outcomes are valid.

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
  EMAIL: SendEmail;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default defineWorkflow({
  agent,
  input: v.object({
    subject: v.optional(v.string()),
    context: v.optional(v.string()),
    to: v.optional(v.string()),
  }),
  output: v.object({
    ok: v.boolean(),
    messageId: v.optional(v.string()),
    to: v.optional(v.string()),
    subject: v.optional(v.string()),
    code: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const subject = input.subject ?? 'Flue agent notification';
    const context = input.context ?? 'A test email from the flue-snippets repo.';
    const to = input.to ?? e.EMAIL_TO;
    if (!e.EMAIL_FROM) return { ok: false, code: 'E_MISSING_EMAIL_FROM' };
    if (!to) return { ok: false, code: 'E_MISSING_EMAIL_TO' };

    const session = await harness.session();
    const drafted = await session.prompt(
      `Draft a short plain-text email body (2-4 sentences, no greeting or signature) about:\n\n${context}`,
    );
    const text = drafted.text.trim();
    const html = `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`;
    try {
      const { messageId } = await e.EMAIL.send({ to, from: e.EMAIL_FROM, subject, text, html });
      return { ok: true, messageId, to, subject };
    } catch (err) {
      const ex = err as { code?: string; message?: string };
      return { ok: false, code: ex.code ?? 'E_UNKNOWN', error: ex.message ?? String(err) };
    }
  },
});
