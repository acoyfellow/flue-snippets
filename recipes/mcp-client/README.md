---
title: mcp-client
tagline: 'A Flue agent calls a tool from a co-hosted MCP server.'
composes: [MCP, Cloudflare Agents SDK, Workers AI, Durable Objects]
---

# mcp-client

`McpClient` declares the co-hosted reverse-string server with `defineMcpConnection` and mounts it with `useMcpConnection`. Connection discovery happens in request context, and the model receives the MCP tool under its server namespace. The co-hosted `ReverseServer` remains a Workers Durable Object mounted at `/mcp`.

## Route

Send a JSON user message to `POST /agents/mcp-client/<conversationId>`. Admission returns HTTP 202; poll `GET` on that same URL until the reply contains the reversed string.

## Run

```sh
bash recipes/mcp-client/run-e2e.sh
```
