# 06 · Flue + AI Gateway

> Three lines of config = caching + observability + retry + rate limit
> for every prompt. Same Flue agent, different baseUrl.

## What it does

A Flue agent calls OpenAI through Cloudflare AI Gateway instead of
directly. The gateway is a transparent proxy that the OpenAI SDK can't
tell apart from openai.com.

## Why this matters

Most agent code treats observability as a separate concern: you ship a
working agent, then later you bolt on logging, then later you add caching,
then later you discover you've burned $300 on a single buggy loop. AI
Gateway is the cheapest possible upgrade — three lines — that gives you
all of that.

Combined with Flue's `providers` config, this works for any agent in your
portfolio. No SDK rewrites, no custom client. Just `baseUrl`.

This is the kind of snippet that shows what "Flue agent + Cloudflare
primitive" looks like at its smallest. ~10 LOC of actual code; the value
is in what you don't have to write.

## Cloudflare primitive in play

[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) —
unified observability + caching + rate limit for any LLM provider. Free
tier is generous; paid tier scales.

## Lines of code

15.

## Run it

```bash
CF_ACCOUNT_ID=... AI_GATEWAY_ID=... OPENAI_API_KEY=... \
  flue run 06-ai-gateway --payload '{"message":"hello"}'
```
