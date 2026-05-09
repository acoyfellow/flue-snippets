# worker-loader

> Run dynamic code in a child Worker isolate. AI-generated code, user
> uploads, sandboxed evals.

```sh
bash examples/worker-loader/run-e2e.sh
```

`env.LOADER.get(id, factory)` spins up a child Worker in its own
isolate. The factory describes what code to load and which bindings
the child sees (none, by default). The parent calls `child.fetch(req)`
and forwards the response.

For a stateful variant — child code as a Durable Object with its own
SQLite storage — see Cloudflare's
[Durable Object Facets](https://developers.cloudflare.com/dynamic-workers/usage/durable-object-facets/).
