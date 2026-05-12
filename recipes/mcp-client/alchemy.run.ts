/**
 * alchemy.run.ts — declarative deploy for the mcp-client recipe.
 *
 * Deploys TWO Workers in one lifecycle:
 *
 *   1. flue-rx-mcp-srv  — the MCP server (raw Worker). Entrypoint is
 *      `./mcp-server.ts` at the recipe root; alchemy bundles it without
 *      going through `flue build`. Exposes one tool (`reverse_string`)
 *      at /mcp via the Streamable HTTP MCP transport.
 *
 *   2. flue-rx-mcp-cli  — the Flue agent that consumes the server. Built
 *      by `flue build` into `.build/dist/_entry.ts`, deployed with its
 *      own DO namespace + Workers AI binding, and given the server's
 *      `/mcp` URL via the MCP_URL var.
 *
 * Both Workers are created and destroyed by the same `alchemy deploy`
 * / `alchemy destroy` pair. The recipe is self-contained — no external
 * MCP server, no third-party dependency.
 *
 * TODO: confirm alchemy's `Worker({ entrypoint: './mcp-server.ts' })`
 * happily bundles a raw .ts file at the recipe root. It should — alchemy
 * runs an esbuild pass on the entrypoint regardless of source — but if
 * the lifecycle ever fails at the build step, the fallback is to put
 * the server in its own folder with its own tsconfig/wrangler-shaped
 * config.
 */

import alchemy from 'alchemy';
import { Ai, DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const STAGE = process.env.STAGE ?? 'local';

const app = await alchemy('flue-rx-mcp-client', { stage: STAGE });

// 1. MCP server. Not a Flue agent — raw Worker built directly from
//    ./mcp-server.ts. The DO namespace name must match the class name
//    exported from that file (`ReverseServer`) so McpAgent.serve()
//    can find its per-session DO.
const server = await Worker(`flue-rx-mcp-srv-${STAGE}`, {
  entrypoint: './mcp-server.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    ReverseServer: DurableObjectNamespace('ReverseServer', {
      className: 'ReverseServer',
      sqlite: true,
    }),
  },
});

// 2. Flue agent that calls the MCP server. The MCP_URL var is wired
//    to the server Worker's deployed URL + /mcp so the client knows
//    where to connect. McpClient is the auto-generated DO class name
//    Flue emits for the `mcp-client` agent.
const client = await Worker(`flue-rx-mcp-cli-${STAGE}`, {
  entrypoint: '.build/dist/_entry.ts',
  compatibilityDate: '2026-04-01',
  compatibility: 'node',
  bindings: {
    AI: Ai(),
    McpClient: DurableObjectNamespace('McpClient', {
      className: 'McpClient',
      sqlite: true,
    }),
    MCP_URL: `${server.url}/mcp`,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_TOKEN ?? '',
  },
});

// Print both URLs so a human can see the topology, but print the
// client URL LAST so `run-e2e.sh`'s `tail -1` grep picks it up as the
// thing to probe.
console.log(`MCP SERVER: ${server.url}`);
console.log(`CLIENT:     ${client.url}`);
console.log(client.url);

await app.finalize();
