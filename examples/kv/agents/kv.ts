// examples/kv — write a key, read it back.

import type { FlueContext } from '@flue/sdk/client';

interface Env {
  KV: KVNamespace;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const key = payload.key ?? 'hello';
  const value = payload.value ?? 'world';
  await env.KV.put(key, String(value));
  const got = await env.KV.get(key);
  return { key, written: value, read: got, match: got === String(value) };
}
