'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

const r2RoundTrip = defineTool({
	name: 'r2_round_trip',
	description: 'Write an object to R2, read it back, and report whether it matched.',
	input: v.object({
		key: v.string(),
		body: v.string(),
	}),
	async run({ data }) {
		const { BUCKET } = env as unknown as { BUCKET: R2Bucket };
		await BUCKET.put(data.key, data.body);
		const object = await BUCKET.get(data.key);
		const read = object ? await object.text() : '';
		return { output: { key: data.key, read, match: read === data.body } };
	},
});

export function R2Storage(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(r2RoundTrip);
	return 'Call r2_round_trip exactly once with the key and body the user gives you, then report the key, value read back, and whether it matched.';
}
