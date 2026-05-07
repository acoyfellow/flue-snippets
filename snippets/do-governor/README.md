# 16 · DO Run Governor

> Persistent state is useful when it changes the next action.

## What it does

The agent records a tiny run state on every turn: cycle count, recent actions,
and a stuck score. Repeating the same action pushes the governor from
`continue` to `reanchor` to `ask-human`.

The minimal snippet takes `payload.state` and returns the next `state`, so it is
easy to test locally. The Alchemy sketch shows the production shape: move that
state into a Durable Object binding.

## Why this matters

This is the practical version of a "state layer" in front of an LLM. The state
does not replace the model. It stops the model from blindly continuing when the
run is going stale.

## Three-way proof

- Flue: session-backed agent loop.
- Alchemy Effect v2: declares the Worker and Durable Object namespace.
- Dogfood primitive: local `govern()` control policy, small enough to graduate
  into `@acoyfellow/run-governor` only if other snippets demand it.

## Sources

- Alchemy Stack/provider pattern:
  `~/cloudflare/alchemy-effect/README.md`
- Cloudflare worker async resource pattern:
  `~/cloudflare/alchemy-effect/examples/cloudflare-worker-async/alchemy.run.ts`
- Durable Object session precedent:
  `batch-b/08-do-session/agent.ts`
