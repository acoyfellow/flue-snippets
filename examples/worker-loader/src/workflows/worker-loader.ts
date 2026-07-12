import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/worker-loader — load a child Worker at request time. Flue 1.0 workflow.
// env.LOADER.get(id, factory) returns a stub for a child Worker in its own
// isolate; getEntrypoint().fetch() invokes its default export.

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
      globalOutbound?: null | Fetcher;
    }>,
  ): DynamicWorker;
}
interface Env {
  LOADER: Loader;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

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

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ code: v.optional(v.string()) }),
  output: v.object({ childStatus: v.number(), childBody: v.string(), childId: v.string() }),
  async run({ input }) {
    const { LOADER } = env as unknown as Env;
    const code = input.code ?? DEFAULT_CHILD_CODE;
    const id = `child-${hash(code)}`;
    const worker = LOADER.get(id, async () => ({
      compatibilityDate: '2026-04-01',
      mainModule: 'index.js',
      modules: { 'index.js': code },
      globalOutbound: null,
    }));
    const childResponse = await worker.getEntrypoint().fetch('https://child.invalid/');
    const childBody = await childResponse.text();
    return { childStatus: childResponse.status, childBody, childId: id };
  },
});

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
