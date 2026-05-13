// examples/hyperdrive, query Postgres via a Hyperdrive binding.
//
// Hyperdrive proxies + pools Postgres so Workers can talk to it from
// the edge. We use the `postgres` driver against `env.HYPERDRIVE`'s
// `connectionString`. Returns `{ now, msg }` from a trivial query.
//
// This example only fully runs with a real Postgres reachable from
// the Hyperdrive config, see README. Without one, the deploy
// succeeds and the endpoint returns an error mentioning hyperdrive,
// which is enough to verify the binding wiring.

import postgres from 'postgres';
import type { FlueContext } from '@flue/sdk/client';

interface Env {
  HYPERDRIVE: { connectionString: string };
}

export const triggers = { webhook: true };

export default async function ({ env }: FlueContext & { env: Env }) {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
  try {
    const rows = await sql<{ now: Date; msg: string }[]>`SELECT NOW() as now, 'hello from pg' as msg`;
    const row = rows[0];
    return { now: row?.now?.toISOString?.() ?? null, msg: row?.msg ?? null };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
