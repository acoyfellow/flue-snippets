---
title: mcp-client
tagline: 'A Flue agent uses a tool from a co-hosted MCP server. Real fetch, real model call, real round-trip.'
composes: [MCP, Cloudflare Agents SDK, Workers AI, Durable Objects]
---

# mcp-client

> A Flue agent uses a tool from a co-hosted MCP server. Real fetch, real model call, real round-trip.

## Composes

- **[Flue](https://flueframework.com)** — `connectMcpServer()` + `init({ tools })`
- **[Model Context Protocol](https://modelcontextprotocol.io)** — Streamable HTTP transport
- **[Cloudflare Agents SDK](https://developers.cloudflare.com/agents/model-context-protocol/)** — `McpAgent` running on a sibling Worker
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — the model that decides to call the tool
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — per-session storage for both the MCP server and the Flue agent

## What it proves

- Flue can wire **any** MCP server as agent tools — `mcp.tools` plugs directly into `init({ tools })`.
- The MCP server itself can run on Workers using `McpAgent` from the `agents/mcp` package.
- The model successfully picks the tool, calls it over the wire, and surfaces the result.
- Zero external dependencies — the recipe deploys both Workers, asserts the round-trip, and destroys both.

## Architecture

```
   ┌──────────────────────────┐  POST /agents/mcp-client/<id>
   │  probe.ts                │ ─────────────────────────────┐
   └──────────────────────────┘                              │
                                                             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  flue-rx-mcp-cli-<stage>.workers.dev  (Flue agent Worker)    │
   │  ┌────────────────────────────────────────────────────────┐  │
   │  │ agents/mcp-client.ts:                                  │  │
   │  │   mcp = connectMcpServer('reverser', { url: env.MCP_URL })
   │  │   harness = init({ model, tools: mcp.tools })          │  │
   │  │   session.prompt('reverse "octarine" via the tool')    │  │
   │  └────────────────────────────────────────────────────────┘  │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ MCP / Streamable HTTP
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  flue-rx-mcp-srv-<stage>.workers.dev  (raw Worker, McpAgent) │
   │  ┌────────────────────────────────────────────────────────┐  │
   │  │ mcp-server.ts: ReverseServer extends McpAgent          │  │
   │  │   server.tool('reverse_string', { input }, ...)        │  │
   │  │ export default ReverseServer.serve('/mcp')             │  │
   │  └────────────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────────────┘
```

Both Workers are declared in a single `alchemy.run.ts` and deployed/destroyed together. The MCP server lives at `recipes/mcp-client/mcp-server.ts` (deliberately outside `agents/`, so `flue build` ignores it — alchemy bundles it as a separate Worker entrypoint).

## Run

```sh
bash recipes/mcp-client/run-e2e.sh
```

The probe POSTs `{ text: 'octarine' }` to `/agents/mcp-client/<id>` and asserts the response contains `eniratco`.

## Why this matters

The "agent + your own MCP server" pattern is how teams expose internal APIs to LLMs without handing the model a raw API token or a sprawling tool schema. The MCP server stays in your VPC (or, here, your Workers account) with its own auth boundary; the agent calls it as if it were any other tool; the model never sees credentials. This recipe is the smallest end-to-end demonstration of that pattern — one tool, one round-trip, real wire — and it's self-contained, so it works as a starter for any "Flue + your-internal-MCP" build.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/mcp-client.ts` | ~60 | the Flue agent — `connectMcpServer` + `init({ tools })` |
| `mcp-server.ts` | ~45 | the co-hosted MCP server (raw Worker, `McpAgent`) |
| `alchemy.run.ts` | ~70 | deploys both Workers + DO namespaces |
| `gateproof.plan.ts` | ~40 | 1 gate: `mcp-reverse-string-round-trip` |
| `probe.ts` | ~55 | POSTs known input, asserts the reversal came back |
| `run-e2e.sh` | ~55 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
