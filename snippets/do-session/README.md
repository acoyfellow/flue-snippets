# 08 · Flue + Durable Object sessions

> Per-user agent state survives restarts, geo-pins to the user, scales
> to a million users. Zero session-store code.

## What it does

When deployed to Cloudflare via `flue build --target cloudflare`, every
unique URL path segment after `/agents/<name>/` becomes a Durable Object
keyed to that user. Same path = same DO = same history. New path =
fresh agent.

## Why this matters

Per-user persistent state is usually a separate service: Redis, Postgres,
DynamoDB, plus the glue code, plus the migration story, plus the
session-key crypto. With Flue + DOs you get:

- Single-writer per user (no race conditions on history).
- Geo-pinned (the DO lives near the user, not in a datacenter halfway
  around the world).
- Automatic alarms (the agent can wake itself up to do proactive work).
- SQLite backing (you can store more than just chat history without a
  schema migration).

This snippet is 9 lines of actual code because the rest is Cloudflare's
job. The leverage is what's *not* there.

## Cloudflare primitive in play

[Durable Objects](https://developers.cloudflare.com/durable-objects/) +
[Flue's session model](https://github.com/withastro/flue#agents-and-sessions).
Sessions are DO-backed automatically when target is Cloudflare.

## Lines of code

12.

## Run it

```bash
flue dev --target cloudflare

# Start a conversation
curl http://localhost:3583/agents/08-do-session/alice \
  -d '{"message":"My name is Alice"}'

# Continue it (same path = same DO)
curl http://localhost:3583/agents/08-do-session/alice \
  -d '{"message":"What is my name?"}'
# → "Your name is Alice"
```
