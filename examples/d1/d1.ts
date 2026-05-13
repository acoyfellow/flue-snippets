// examples/d1, INSERT a row, SELECT it back.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  DB: D1Database;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  // Idempotent table create
  await env.DB.exec(
    'CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)',
  );
  const body = String(payload.body ?? 'hello from d1');
  const ins = await env.DB.prepare('INSERT INTO notes (body) VALUES (?)').bind(body).run();
  const id = ins.meta.last_row_id;
  const got = await env.DB.prepare('SELECT body FROM notes WHERE id = ?')
    .bind(id)
    .first<{ body: string }>();
  return { id, written: body, read: got?.body, match: got?.body === body };
}
