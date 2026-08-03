---
title: do-session
tagline: 'One durable conversation per user id, persisted across requests.'
composes: [Durable Objects, Workers AI]
---

# do-session

`DoSession` is a conversational Flue 2 agent. Flue generates one Durable Object-backed conversation for each id in `/agents/do-session/<userId>`, so the same id retains history without Redis, Postgres, or custom session code.

## What it proves

- The same user id reaches the same durable agent conversation.
- A second admitted message can recall a fact from the first turn.
- The client posts `{ "kind": "user", "body": "..." }`, receives `202`, and polls `GET` on that same URL for the settled snapshot.

## Run

```sh
bash recipes/do-session/run-e2e.sh
```
