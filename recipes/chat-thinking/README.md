---
title: chat-thinking
tagline: 'Flue (orchestrator) hands off to a Cloudflare Think DO (chat surface).'
composes: [Cloudflare Think, Durable Objects, Workers AI]
---

# chat-thinking

> Flue (orchestrator) hands off to a Cloudflare Think DO (chat surface).

## Composes

- **[Flue](https://flueframework.com)**, webhook agent, the autonomous/headless entry point
- **[`@cloudflare/think`](https://developers.cloudflare.com/agents/api-reference/think/)**, opinionated chat agent base class with tree-structured messages, context blocks, FTS5 search, and non-destructive compaction
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**, SQLite-backed namespace that gives every chatId its own persistent Think instance
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, kimi-k2.6 via [`workers-ai-provider`](https://www.npmjs.com/package/workers-ai-provider)

## What it proves

- A Flue webhook agent can compose with a Think chat agent via DO RPC (`chat()`)
- Two POSTs to the same `chatId` route to the same `Thinker` DO and Think remembers turn 1 in turn 2
- The Flue layer stays stateless and structured; the Think layer owns the conversational memory
- Zero session-store boilerplate, the Think DO is the session, and alchemy declares the namespace in one line

## Why not just use Flue's built-in session?

Flue's built-in session (see `recipes/do-session`) is great for short
back-and-forths where you only need a flat history. Think is a different
shape, it's a full chat agent base class with:

- **Tree-structured messages**, branch a conversation, retry a turn, fork at any point
- **Context blocks**, first-class system prompts, tool messages, attached files
- **FTS5 search**, query past conversations by content directly out of the DO's SQLite
- **Non-destructive compaction**, summarise long histories without losing the originals

If you're building a long-running chat surface (think: an assistant that
lives for weeks, an agent that compacts and resurfaces context), Think
is the substrate. Flue stays the orchestrator that drives it.

## Run

```sh
bash recipes/chat-thinking/run-e2e.sh
```

The probe POSTs twice to `/agents/chat-thinking/<chatId>` and asserts
the second turn recalls the first turn's content via the Think DO's
persistent history.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/chat-thinking.ts` | 62 | the snippet, Flue webhook + exported `Thinker` Think subclass |
| `alchemy.run.ts` | 46 | Worker + AI + two DO bindings (`ChatThinking`, `Thinker`) |
| `gateproof.plan.ts` | 41 | 1 gate: probe asserts Think memory persists across turns |
| `probe.ts` | 53 | two-turn fetch loop against the same chatId |
| `run-e2e.sh` | 59 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
