---
title: effect-hello
tagline: 'The simplest Flue agent whose tool body is an Effect program.'
composes: [Workers AI, Effect v4]
---

# effect-hello

> The simplest Flue agent whose tool body is an Effect program. The agent
> handles the conversation while the greeting capability runs inside
> `Effect.gen` and is executed with one `Effect.runPromise` call.

```sh
bash examples/effect-hello/run-e2e.sh
```

Send `Greet Alice.` to `POST /agents/effect-hello/<conversationId>`, then
read the same URL until the `create_greeting` tool output contains a greeting.

## What it proves

An agent tool can run an `Effect.Effect<string, Error>` through an
`Effect.Runtime`. The Flue side handles the model, tool registration, and
conversation; the Effect side handles typed errors, timeouts, retries, and
structured concurrency.

The seam between the two systems is one line:

```ts
const greeting = await Effect.runPromise(greet(name));
```

Everything below that line is Effect. Everything above it is Flue.

## How it differs from `examples/workers-ai`

| | `workers-ai` | `effect-hello` |
| --- | --- | --- |
| Capability | model response only | `Effect.gen` greeting tool |
| Errors | model/runtime errors | typed Effect errors |
| Timeout | none | `Effect.timeout('30 seconds')` on the program |
| What scales | more model interactions | more combinators (`Effect.retry`, `Effect.forEach({ concurrency })`, and so on) |

For more substantial Effect agents (concurrency, retry, streaming,
approval flows, typed errors, and MCP), see
[acoyfellow/effect-agents](https://github.com/acoyfellow/effect-agents).
