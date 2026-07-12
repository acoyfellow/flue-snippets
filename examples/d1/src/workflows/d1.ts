import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/d1 — INSERT a row, SELECT it back. Flue 1.0 workflow.

interface Env {
  DB: D1Database;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ body: v.string() }),
  output: v.object({ id: v.number(), read: v.string(), match: v.boolean() }),
  async run({ input }) {
    const { DB } = env as unknown as Env;
    await DB.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
    const ins = await DB.prepare('INSERT INTO notes (body) VALUES (?)').bind(input.body).run();
    const id = Number(ins.meta.last_row_id);
    const got = await DB.prepare('SELECT body FROM notes WHERE id = ?')
      .bind(id)
      .first<{ body: string }>();
    const read = got?.body ?? '';
    return { id, read, match: read === input.body };
  },
});
