'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

type DynamicWorker = {
	getEntrypoint(): { fetch: (request: Request | string) => Promise<Response> };
};

type Loader = {
	get(id: string, factory: () => Promise<{ compatibilityDate: string; mainModule: string; modules: Record<string, string>; globalOutbound?: null | Fetcher }>): DynamicWorker;
};

const defaultChildCode = `
export default {
  fetch(req) {
    return new Response(
      JSON.stringify({ from: 'child', url: req.url, when: Date.now() }),
      { headers: { 'content-type': 'application/json' } },
    );
  },
};
`;

const loadWorker = defineTool({
	name: 'load_worker',
	description: 'Load a child Worker, invoke it, and report its response.',
	input: v.object({
		code: v.optional(v.string()),
	}),
	async run({ data }) {
		const { LOADER } = env as unknown as { LOADER: Loader };
		const code = data.code ?? defaultChildCode;
		const childId = `child-${hash(code)}`;
		const worker = LOADER.get(childId, async () => ({
			compatibilityDate: '2026-04-01',
			mainModule: 'index.js',
			modules: { 'index.js': code },
			globalOutbound: null,
		}));
		const response = await worker.getEntrypoint().fetch('https://child.invalid/');
		const childBody = await response.text();
		return { output: { childStatus: response.status, childBody, childId } };
	},
});

export function WorkerLoader(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(loadWorker);
	return 'Call load_worker exactly once with the optional child code the user gives you, then report the child status, body, and id.';
}

function hash(value: string): string {
	let hashValue = 0;
	for (let index = 0; index < value.length; index++) hashValue = ((hashValue << 5) - hashValue + value.charCodeAt(index)) | 0;
	return Math.abs(hashValue).toString(36);
}
