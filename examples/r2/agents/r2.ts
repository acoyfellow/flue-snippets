// examples/r2 — write an object, read it back.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  BUCKET: R2Bucket;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const key = payload.key ?? 'hello.txt';
  const body = payload.body ?? 'hello from r2';
  await env.BUCKET.put(key, body);
  const obj = await env.BUCKET.get(key);
  const text = obj ? await obj.text() : null;
  return { key, written: body, read: text, match: text === body };
}
