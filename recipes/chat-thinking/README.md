---
title: chat-thinking
tagline: 'Read model reasoning and final text as separate parts of one durable Flue conversation.'
composes: [Durable Objects, Workers AI]
---

# chat-thinking

Flue 2 replaces the old handoff operation with one conversational `ChatThinking` agent. Its generated Durable Object owns conversation persistence, while the reasoning-capable Workers AI model emits `reasoning` and `text` parts in the same conversation snapshot.

## What it proves

- A conversation at `/agents/chat-thinking/<conversationId>` is durable and can retain useful context across turns.
- The modern thinking surface is a `reasoning` part alongside a `text` part, not a separate response type.
- The harness posts an admitted user message and polls `GET` on the same URL until both parts appear.

## Run

```sh
bash recipes/chat-thinking/run-e2e.sh
```

The deploy harness is intentionally separate from static verification because it provisions billable Cloudflare resources.
