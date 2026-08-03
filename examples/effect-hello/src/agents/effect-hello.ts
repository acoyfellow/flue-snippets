'use agent';

import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import { Effect } from 'effect';
import * as v from 'valibot';

const greet = (name: string) =>
	Effect.gen(function* () {
		return `Hello, ${name}!`;
	}).pipe(Effect.timeout('30 seconds'));

const createGreeting = defineTool({
	name: 'create_greeting',
	description: 'Create a short friendly greeting for a name through an Effect program.',
	input: v.object({
		name: v.string(),
	}),
	async run({ data }) {
		const greeting = await Effect.runPromise(greet(data.name));
		return { output: { greeting } };
	},
});

export function EffectHello(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(createGreeting);
	return 'Call create_greeting exactly once with the name the user provides, then report the returned greeting.';
}
