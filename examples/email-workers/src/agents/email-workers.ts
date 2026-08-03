'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, type JsonValue, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

const sendEmail = defineTool({
	name: 'send_email',
	description: 'Send a plain-text email using the configured Cloudflare Email Service sender and recipient.',
	input: v.object({
		subject: v.string(),
		text: v.string(),
	}),
	async run({ data }) {
		const configured = env as unknown as Env;
		if (!configured.EMAIL_FROM) {
			return { output: { ok: false, code: 'E_MISSING_EMAIL_FROM' } as JsonValue };
		}
		if (!configured.EMAIL_TO) {
			return { output: { ok: false, code: 'E_MISSING_EMAIL_TO' } as JsonValue };
		}

		const html = `<p>${escapeHtml(data.text).replace(/\n/g, '<br/>')}</p>`;
		try {
			const { messageId } = await configured.EMAIL.send({
				to: configured.EMAIL_TO,
				from: configured.EMAIL_FROM,
				subject: data.subject,
				text: data.text,
				html,
			});
			return { output: { ok: true, messageId, to: configured.EMAIL_TO, subject: data.subject } as JsonValue };
		} catch (error) {
			const failure = error as { code?: string; message?: string };
			return {
				output: {
					ok: false,
					code: failure.code ?? 'E_UNKNOWN',
					error: failure.message ?? String(error),
				} as JsonValue,
			};
		}
	},
});

export function EmailWorkers(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(sendEmail);
	return 'When asked to send an email, draft a short plain-text body from the request and call send_email exactly once. Report the returned send result, including a structured error code when sending is unavailable.';
}
