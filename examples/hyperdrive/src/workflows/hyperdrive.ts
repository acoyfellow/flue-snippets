import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import postgres from 'postgres';
import * as v from 'valibot';

// examples/hyperdrive — query Postgres via a Hyperdrive binding. Flue 1.0
// workflow. Hyperdrive proxies + pools Postgres for edge access. Fully runs
// only with a real Postgres reachable from the config; without one the
// workflow returns a structured { ok:false, error } mentioning the DB layer,
// which verifies the binding wiring.

interface Env {
  HYPERDRIVE: { connectionString: string };
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({}),
  output: v.object({
    ok: v.boolean(),
    now: v.optional(v.nullable(v.string())),
    msg: v.optional(v.nullable(v.string())),
    error: v.optional(v.string()),
  }),
  async run() {
    const { HYPERDRIVE } = env as unknown as Env;
    const sql = postgres(HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
    try {
      const rows = await sql<
        { now: Date; msg: string }[]
      >`SELECT NOW() as now, 'hello from pg' as msg`;
      const row = rows[0];
      return { ok: true, now: row?.now?.toISOString?.() ?? null, msg: row?.msg ?? null };
    } catch (err) {
      return {
        ok: false,
        error: `postgres/hyperdrive: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
});
