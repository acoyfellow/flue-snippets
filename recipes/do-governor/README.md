---
title: do-governor
tagline: 'Persist run state and change the next action when an agent loops.'
composes: [Durable Objects, Workers AI]
---

# do-governor

The former caller-threaded state operation is a Flue 2 agent with durable `usePersistentState` and a `govern` tool. The agent's generated Durable Object stores each conversation's cycle, recent actions, and stuck score. The tool returns `{ output: { state, decision } }` so the conversation records the deterministic policy result.

## What it proves

- Repeated actions persist in the agent instance rather than in a client request body.
- The policy moves from `continue` to `reanchor` and then `ask-human` as repetitions accumulate.
- Client delivery posts to `/agents/do-governor/<conversationId>` and polls the same conversation URL for the tool result.

## Run

```sh
bash recipes/do-governor/run-e2e.sh
```
