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

The workflow accepts `POST /workflows/kv?wait=result`, calls `env.KV.put(key,
value)` and `env.KV.get(key)`, and returns `{ key, read, match }`. The E2E test
provisions an ephemeral KV namespace, builds and deploys the Worker, asserts
`match === true`, then deletes both the Worker and namespace.
