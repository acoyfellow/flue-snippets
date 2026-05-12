---
title: do-session
tagline: 'One agent per user, persisted across requests, geo-pinned to the user.'
composes: [Durable Objects]
---

# do-session

> One agent per user, persisted across requests, geo-pinned to the user.

## Composes

- **[Flue](https://flueframework.com)** — agent shape with built-in session storage
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — per-user DO holds the conversation history

## What it proves

- A Flue agent deployed to Cloudflare auto-wires session storage into a per-agent DO
- The same `userId` in the URL path routes to the same DO instance
- Two POSTs to the same user share state — turn 2 recalls a fact set in turn 1
- Zero Redis, zero Postgres, zero session-store boilerplate

## Run

```sh
bash recipes/do-session/run-e2e.sh
```

The probe POSTs twice to `/agents/do-session/<userId>` and asserts the
second turn recalls the first turn's content.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/do-session.ts` | 10 | the snippet (smallest in the repo) |
| `alchemy.run.ts` | 21 | Worker + DO binding |
| `gateproof.plan.ts` | 37 | 1 gate: probe asserts session memory |
| `probe.ts` | 49 | two-turn fetch loop |
| `run-e2e.sh` | 53 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
