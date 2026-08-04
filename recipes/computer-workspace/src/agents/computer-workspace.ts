'use agent';

import { type DurableObjectStorageLike, Workspace } from '@cloudflare/computer';
import { defineTool, useModel, useTool } from '@flue/runtime';
import { getCurrentAgent } from 'agents';
import * as v from 'valibot';

// @cloudflare/computer gives the agent a real filesystem on top of the SQLite
// that already lives inside this agent's Durable Object. There is no container
// to boot and no volume to attach. The files persist because the Durable Object
// persists, so the same conversation id sees the same disk on the next request.
function workspace(): Workspace {
	const { agent } = getCurrentAgent();
	if (!agent) throw new Error('no current agent: the workspace needs a Durable Object');
	const { ctx } = agent as unknown as { ctx: { storage: DurableObjectStorageLike } };
	return new Workspace({ storage: ctx.storage });
}

const writeNote = defineTool({
	name: 'write_note',
	description: 'Save a file into the durable workspace under /notes.',
	input: v.object({
		name: v.string(),
		body: v.string(),
	}),
	async run({ data }) {
		const fs = workspace().fs;
		await fs.mkdir('/notes', { recursive: true });
		await fs.writeFile(`/notes/${data.name}`, data.body);
		return { output: `wrote /notes/${data.name}` };
	},
});

const readNote = defineTool({
	name: 'read_note',
	description: 'Read one file back out of the durable workspace.',
	input: v.object({ name: v.string() }),
	async run({ data }) {
		const text = await workspace().fs.readFile(`/notes/${data.name}`, 'utf8');
		return { output: text };
	},
});

const listNotes = defineTool({
	name: 'list_notes',
	description: 'List the files that exist in the durable workspace.',
	input: v.object({}),
	async run() {
		const entries = await workspace().fs.readdir('/notes');
		const names = entries.map((entry) => entry.name).sort();
		return { output: names.length > 0 ? names.join('\n') : '(empty)' };
	},
});

const grepNotes = defineTool({
	name: 'grep_notes',
	description: 'Search every file in the durable workspace for a pattern.',
	input: v.object({ pattern: v.string() }),
	async run({ data }) {
		const matches = await workspace().fs.grep(data.pattern, '/notes');
		if (matches.length === 0) return { output: 'no matches' };
		return { output: matches.map((m) => `${m.path}:${m.line}: ${m.text}`.trim()).join('\n') };
	},
});

export function ComputerWorkspace() {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(writeNote);
	useTool(readNote);
	useTool(listNotes);
	useTool(grepNotes);
	return [
		'You keep a persistent filesystem for the user.',
		'Use write_note to save a file and read_note to read one back.',
		'Use list_notes to see the files and grep_notes to search them.',
		'Report the tool output exactly. Never invent file contents.',
	].join(' ');
}
