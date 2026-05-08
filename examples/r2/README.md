# r2

> Write an object, read it back. The agent's filesystem at the edge.

```sh
bash examples/r2/run-e2e.sh
```

`env.BUCKET.put(key, body)` then `env.BUCKET.get(key)`. Test asserts
the round-trip body matches.
