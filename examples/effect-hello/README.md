---
title: effect-hello
tagline: 'The simplest Flue agent whose body is an Effect program.'
composes: [Workers AI, Effect v4]
---

# effect-hello

> The simplest Flue agent whose body is an Effect program. The trigger and response shape are pure Flue; the agent runs inside `Effect.gen` and is executed with one `Effect.runPromise` call.

```sh
bash examples/effect-hello/run-e2e.sh
```

POST `{ "name": "Alice" }` to `/agents/effect-hello/<id>` and the Worker returns `{ "greeting": "..." }`.

## What it proves

A Flue webhook's handler can be a one-liner that runs an `Effect.Effect<string, Error>` against an `Effect.Runtime`. The Flue side handles the trigger/response; the Effect side handles the agent semantics — typed errors, timeouts, retries, structured concurrency — all composable.

The seam between the two systems is a single line:

```ts
const greeting = await Effect.runPromise(greet(name, env.AI));
```

That's it. Everything below that line is Effect. Everything above it is Flue.

## How it differs from `examples/workers-ai`

| | `workers-ai` | `effect-hello` |
| --- | --- | --- |
| Body | one `await env.AI.run(...)` | `Effect.gen` wrapping the same call |
| Errors | thrown | typed in the `E` channel of the Effect |
| Timeout | none | `Effect.timeout('30 seconds')` on the program |
| What scales | adding more `await` calls | adding more combinators (`Effect.retry`, `Effect.forEach({ concurrency })`, etc.) |

If you want to see what *real* Effect agents look like — concurrency, retry, streaming, approval flows, typed errors, MCP — see [acoyfellow/effect-agents](https://github.com/acoyfellow/effect-agents).
