'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

const d1RoundTrip = defineTool({
	name: 'd1_round_trip',
	description: 'Insert a note into D1, read it back, and report whether it matched.',
	input: v.object({
		body: v.string(),
	}),
	async run({ data }) {
		const { DB } = env as unknown as { DB: D1Database };
		await DB.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
		const inserted = await DB.prepare('INSERT INTO notes (body) VALUES (?)').bind(data.body).run();
		const id = Number(inserted.meta.last_row_id);
		const note = await DB.prepare('SELECT body FROM notes WHERE id = ?').bind(id).first<{ body: string }>();
		const read = note?.body ?? '';
		return { output: { id, read, match: read === data.body } };
	},
});

export function D1(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(d1RoundTrip);
	return 'Call d1_round_trip exactly once with the body the user gives you, then report the inserted id, value read back, and whether it matched.';
}
