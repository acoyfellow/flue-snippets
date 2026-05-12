// worker.ts — minimal asset-serving Worker.
//
// The Astro build (./dist) is uploaded as an Assets bundle. The runtime
// `env.ASSETS.fetch(request)` does the actual serving (content-type,
// caching, 404 fallbacks). Nothing else to do here.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
