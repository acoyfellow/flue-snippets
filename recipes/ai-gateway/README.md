---
title: ai-gateway
tagline: 'Caching, observability, retry, rate limiting, for free, per prompt.'
composes: [AI Gateway, Workers AI]
---

# ai-gateway

> Caching, observability, retry, rate limiting, for free, per prompt.

## Composes

- **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)**, `env.AI.run(model, args, { gateway: { id } })` routes the call through a CF gateway
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, `@cf/moonshotai/kimi-k2.6` model
- **[Flue](https://flueframework.com)**, agent shape (the agent uses the binding directly; doesn't go through pi-ai's HTTP path)

## What it proves

- A Flue agent uses Cloudflare's Workers AI binding (`env.AI`) directly
- Every prompt routes through the named AI Gateway (`jordan` by default)
- The gateway resource auto-creates on first hit if it doesn't exist
- The deploy token doesn't need AI-Gateway-scoped permissions because the binding does its own auth

## Run

```sh
# Optional: pick a different gateway than the default 'jordan'
export CLOUDFLARE_GATEWAY_ID=my-gateway

bash recipes/ai-gateway/run-e2e.sh
```

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/ai-gateway.ts` | 24 | the snippet |
| `alchemy.run.ts` | 30 | Worker + AI binding + DO + GATEWAY_ID |
| `gateproof.plan.ts` | 39 | 1 gate: real model answer through the gateway |
| `probe.ts` | 43 | asserts answer + gateway echo |
| `run-e2e.sh` | 90 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
