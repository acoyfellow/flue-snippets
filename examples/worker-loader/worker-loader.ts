// examples/worker-loader — load a child Worker at request time.
//
// `env.LOADER.get(id, factory)` returns a stub for a child Worker
// running arbitrary code in its own isolate. Each child has its own
// bindings and globals — none of the parent's. The pattern enables
// "AI agent code mode" or running user-supplied code at the edge.
//
// This example takes child code from the request body, loads it, and
// forwards the request through.

import type { FlueContext } from '@flue/sdk/client';

// Worker Loader runtime API. `get()` returns a Worker stub; call
// `.getEntrypoint()` to get the default-export entrypoint, then
// `.fetch(req)` to invoke it.
interface DynamicWorker {
  getEntrypoint(): { fetch: (req: Request | string) => Promise<Response> };
}
interface Loader {
  get(
    id: string,
    factory: () => Promise<{
      compatibilityDate: string;
      mainModule: string;
      modules: Record<string, string>;
      env?: Record<string, unknown>;
      globalOutbound?: null | Fetcher;
    }>,
  ): DynamicWorker;
}

interface Env {
  LOADER: Loader;
}

export const triggers = { webhook: true };

const DEFAULT_CHILD_CODE = `
export default {
  fetch(req) {
    return new Response(
      JSON.stringify({ from: 'child', url: req.url, when: Date.now() }),
      { headers: { 'content-type': 'application/json' } },
    );
  },
};
`;

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  // Child code can come from the request, an AI model, R2, anywhere.
  const code = String(payload.code ?? DEFAULT_CHILD_CODE);
  // ID is a content-based cache key. Same code → reused isolate.
  const id = `child-${hash(code)}`;

  const worker = env.LOADER.get(id, async () => ({
    compatibilityDate: '2026-04-01',
    mainModule: 'index.js',
    modules: { 'index.js': code },
    // Block outbound network from the child by default. Pass
    // `globalOutbound: env.SOME_FETCHER` to allow.
    globalOutbound: null,
  }));

  // Two-step: get the default-export entrypoint, then fetch through it.
  const entrypoint = worker.getEntrypoint();
  const childResponse = await entrypoint.fetch('https://child.invalid/');
  const childBody = await childResponse.text();

  return { childStatus: childResponse.status, childBody, childId: id };
}

// Tiny non-crypto hash so equivalent code produces the same isolate ID.
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
