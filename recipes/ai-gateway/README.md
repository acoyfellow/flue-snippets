---
title: ai-gateway
tagline: 'Route every Workers AI model turn through a named Cloudflare AI Gateway.'
composes: [AI Gateway, Workers AI]
---

# ai-gateway

`src/app.ts` registers the Workers AI binding provider with a named Cloudflare AI Gateway, cache TTL, and the `CLOUDFLARE_GATEWAY_ID` override. The `AiGateway` agent then makes its normal model turn through that provider.

## What it proves

- A Flue 2 agent uses the `env.AI` binding through `cloudflareBindingProvider`.
- Every model turn is routed through the named gateway (`jordan` unless overridden).
- The old synchronous invocation is now an admitted agent message: `POST /agents/ai-gateway/<conversationId>` returns `202`, and `GET` on the same URL reads the conversation.

## Run

```sh
export CLOUDFLARE_GATEWAY_ID=my-gateway
bash recipes/ai-gateway/run-e2e.sh
```

The harness builds, deploys, waits for route admission, verifies a conversation reply, and removes the Worker. It is not run by static verification.
