'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import postgres from 'postgres';
import * as v from 'valibot';

const queryHyperdrive = defineTool({
	name: 'query_hyperdrive',
	description: 'Query Postgres through Hyperdrive and report either the result or the database error.',
	input: v.object({}),
	async run() {
		const { HYPERDRIVE } = env as unknown as { HYPERDRIVE: { connectionString: string } };
		const sql = postgres(HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
		try {
			const rows = await sql<{ now: Date; msg: string }[]>`SELECT NOW() as now, 'hello from pg' as msg`;
			const row = rows[0];
			return { output: { ok: true, now: row?.now?.toISOString?.() ?? null, msg: row?.msg ?? null, error: null } };
		} catch (error) {
			return { output: { ok: false, now: null, msg: null, error: `postgres/hyperdrive: ${error instanceof Error ? error.message : String(error)}` } };
		} finally {
			await sql.end({ timeout: 5 });
		}
	},
});

export function Hyperdrive(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(queryHyperdrive);
	return 'Call query_hyperdrive exactly once, then report whether the query succeeded, including either the returned timestamp and message or the database error.';
}
