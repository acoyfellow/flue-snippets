'use agent';

// KV example: a Workers KV namespace exposed to the model as a tool.
//
// Flue 2 has no workflows. An agent is a function that returns its
// instructions; anything it should be able to *do* is a tool. So the
// KV round-trip lives in `defineTool` and the model calls it.

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

const kvRoundTrip = defineTool({
	name: 'kv_round_trip',
	description: 'Write a key/value pair to Workers KV, read it back, and report whether the value survived the round trip.',
	input: v.object({
		key: v.string(),
		value: v.string(),
	}),
	async run({ data }) {
		const { KV } = env as unknown as { KV: KVNamespace };
		await KV.put(data.key, data.value);
		const read = await KV.get(data.key);
		return {
			output: {
				key: data.key,
				read: read ?? '',
				match: read === data.value,
			},
		};
	},
});

export function Kv(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(kvRoundTrip);
	return 'Call kv_round_trip exactly once with the key and value the user gives you, then report the returned key, the value you read back, and whether it matched. Answer in one sentence.';
}

