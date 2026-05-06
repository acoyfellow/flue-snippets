# 02 · Flue + deja

> The agent recalls relevant memory before answering and remembers the
> exchange after. Cross-session continuity in 24 lines.

## What it does

On every request: pull the top-5 most relevant Deja slips for the question,
inject them as system context, run the prompt, then persist the new
exchange as a kept slip.

## Why this matters

Flue sessions persist *within* an agent's life (DO-backed thread continuity).
Deja persists *across* sessions, agents, and machines. They occupy
different time scales — Flue handles minutes-hours, Deja handles weeks.

This snippet shows the boundary: Flue's `init({ system })` accepts the Deja
context as a system-prompt overlay, no glue code. The agent doesn't need to
know Deja exists; it just gets a smarter starting prompt.

## Cloudflare primitive in play

Deja runs on Cloudflare Workers + Durable Objects + Vectorize. The recall
happens at the edge, in single-digit milliseconds.

## Lines of code

26.

## Run it

```bash
DEJA_URL=https://deja.coey.dev flue run 02-deja-memory \
  --payload '{"question":"What did we decide about Flue convergence?","topic":"flue"}'
```
