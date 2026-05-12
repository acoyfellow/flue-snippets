---
title: kv
tagline: 'Write a key, read it back. The simplest stateful CF agent.'
composes: [KV]
---

# kv

> Write a key, read it back. The simplest stateful CF agent.

```sh
bash examples/kv/run-e2e.sh
```

The agent does `env.KV.put(key, value)` then `env.KV.get(key)` and
returns `{ written, read, match }`. Test asserts `match === true`.
