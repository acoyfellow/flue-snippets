---
title: kv
tagline: 'Write a key, read it back. The simplest stateful CF workflow.'
composes: [KV]
---

# kv

> Write a key, read it back. The simplest stateful CF workflow.

```sh
bash examples/kv/run-e2e.sh
```

The agent accepts `POST /agents/kv/<conversationId>` (answered `202`), then
`GET` the same URL for the settled conversation. Its `kv_round_trip` tool calls
`env.KV.put(key, value)` and `env.KV.get(key)` and returns `{ key, read, match }`.
The E2E test
provisions an ephemeral KV namespace, builds and deploys the Worker, asserts
`match === true`, then deletes both the Worker and namespace.
