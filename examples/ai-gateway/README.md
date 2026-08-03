---
title: ai-gateway
tagline: 'Workers AI through a Cloudflare AI Gateway. Caching, observability, retries, for free.'
composes: [AI Gateway, Workers AI]
---

# ai-gateway

> Workers AI through a Cloudflare AI Gateway. Caching, observability,
> retries, for free.

```sh
export CLOUDFLARE_GATEWAY_ID=jordan  # or your gateway name
bash examples/ai-gateway/run-e2e.sh
```

`AiGateway` is a synchronous Flue 2 agent that calls `useModel()` once.
`src/app.ts` registers the Workers AI binding with
`cloudflareBindingProvider({ gateway: { id, cacheTtl: 3600 } })`, so every
model request uses the named Cloudflare AI Gateway. The router exposes the
agent at `/agents/ai-gateway`.

`POST /agents/ai-gateway/<conversationId>` admits a message with `202`.
Poll `GET` on that same URL for the assistant answer; the E2E confirms a
non-empty answer that identifies the gateway before deleting the Worker.
