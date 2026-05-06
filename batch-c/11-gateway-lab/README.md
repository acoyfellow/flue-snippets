# 11 · Flue + AI Gateway + lab

> Gateway sees the *traffic*. Lab sees the *work*. Two complementary
> observability planes; one Flue agent.

## What it does

Routes the LLM call through Cloudflare AI Gateway (gets caching, rate
limits, cost tracking) AND emits a Lab receipt for the run (gets the
auditable artifact + handoff URL).

## Why this matters

These two observability layers don't compete; they're orthogonal:
- **AI Gateway** answers "what was the LLM traffic? how much did it cost?
  was it cached? did it succeed?" — about the *prompt-to-token* layer.
- **Lab receipts** answer "what was this agent doing? what was the input
  and output of this *task*? who can pick it up next?" — about the *work*
  layer.

You want both. The receipt links to the gateway log via metadata. The
gateway log doesn't know what the agent was trying to accomplish; the
receipt does. The receipt doesn't know the cache hit rate; the gateway
does.

This is the smallest snippet that demonstrates "Flue + Cloudflare + Jordan
primitives compose without overlap."

## Cloudflare primitive in play

[AI Gateway](https://developers.cloudflare.com/ai-gateway/) for traffic;
Lab (built on Workers + KV) for work.

## Lines of code

29.

## Run it

```bash
CF_ACCOUNT_ID=... AI_GATEWAY_ID=... OPENAI_API_KEY=... LAB_URL=https://lab.coey.dev \
  flue run 11-gateway-lab --payload '{"message":"hello"}'
```
