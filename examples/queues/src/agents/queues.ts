'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

const enqueueMessage = defineTool({
	name: 'enqueue_message',
	description: 'Send a message to a Cloudflare Queue and report the accepted text.',
	input: v.object({
		text: v.optional(v.string()),
	}),
	async run({ data }) {
		const { QUEUE } = env as unknown as { QUEUE: { send: (message: unknown) => Promise<void> } };
		const text = data.text ?? 'hello queue';
		await QUEUE.send({ ts: Date.now(), text });
		return { output: { status: 'enqueued', text } };
	},
});

export function Queues(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(enqueueMessage);
	return 'Call enqueue_message exactly once with the text the user gives you, then report that it was enqueued and the text sent.';
}
