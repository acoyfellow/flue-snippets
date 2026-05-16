---
title: dynamic-workflow
tagline: 'Flue agent enqueues tasks into a DO; a Cloudflare Workflow drains them with steps materialized at runtime.'
composes: [Durable Objects, Workflows]
---

# dynamic-workflow

> A Flue agent enqueues work into a Durable Object queue. A Cloudflare
> Workflow ticks through the queue with `step.do()`, so every task gets
> durable retries and persisted output — even though none of the steps
> are declared at deploy time.

Inspired by Cloudflare's [Dynamic Workflows](https://blog.cloudflare.com/dynamic-workflows/)
post: keep Workflows for durability/observability, keep Durable Objects
for shared state, and let the *shape* of the run be decided by whoever
is enqueueing.

## Composes

- **[Flue](https://flueframework.com)**, the agent front door (one POST per task / per status check)
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**, one `TaskQueue` DO per workflow run id; holds the pending queue and completion log
- **[Workflows](https://developers.cloudflare.com/workflows/)**, `TaskRunnerWorkflow` drains the DO queue tick-by-tick

## What it proves

- A Flue agent and a Cloudflare Workflow can share a single per-run DO
  as the source of truth, without either side needing the
  Cloudflare API.
- Workflow step IDs (`tick-1`, `tick-2`, …) can be generated at runtime;
  the Workflows runtime durably retries each one even though they
  didn't exist in code at deploy time.
- The Flue agent → runner Worker hop is a plain Workers service
  binding, so neither Worker needs an API token.
- Cloudflare Workflows dedupes on `id`, so calling `create({ id })`
  for every enqueue is safe: the workflow starts once and every
  subsequent call just appends to the DO queue.

## Topology

```
            ┌─────────────────────────────────────────────────┐
            │  flue-rx-dynwf-cli  (Flue agent Worker)         │
            │                                                 │
  POST  ──► │  agents/dynamic-workflow.ts                     │
            │    env.RUNNER.fetch(/enqueue/:runId)            │
            │    env.RUNNER.fetch(/status/:runId)             │
            └─────────────────┬───────────────────────────────┘
                              │ service binding
            ┌─────────────────▼───────────────────────────────┐
            │  flue-rx-dynwf-run  (raw Worker)                │
            │                                                 │
            │  runner.ts default.fetch:                       │
            │    /enqueue/:id → DO.push + Workflow.create     │
            │    /status/:id  → DO.size + Workflow.status     │
            │                                                 │
            │  ┌──────────────────────────────┐               │
            │  │ TaskQueue (DO, sqlite=true)  │               │
            │  │   push / shift / completed   │               │
            │  └──────────────────────────────┘               │
            │                  ▲                              │
            │                  │ this.env.TASK_QUEUE          │
            │  ┌───────────────┴──────────────┐               │
            │  │ TaskRunnerWorkflow           │               │
            │  │   for tick in 1..MAX_TICKS:  │               │
            │  │     step.do(`tick-${tick}`)  │               │
            │  │       shift task from DO     │               │
            │  │       execute               │                │
            │  │     step.sleep on idle      │                │
            │  └──────────────────────────────┘               │
            └─────────────────────────────────────────────────┘
```

## Run

```sh
bash recipes/dynamic-workflow/run-e2e.sh
```

The probe POSTs three tasks (`alpha`, `beta`, `gamma`) to the same
`runId`, polls `/status` until the Workflow instance reports
`complete`, and asserts all three tasks were drained in order.

## Files

| File | Role |
|---|---|
| `agents/dynamic-workflow.ts` | the Flue agent — enqueue / status front door |
| `runner.ts` | raw Worker, exports `TaskQueue` DO + `TaskRunnerWorkflow` + control-plane fetch |
| `alchemy.run.ts` | two Workers, Workflow binding, DO namespace, service binding |
| `gateproof.plan.ts` | 1 gate: probe asserts ordered drain + workflow complete |
| `probe.ts` | enqueue 3 tasks, poll, assert order |
| `run-e2e.sh` | build → deploy → warmup → assert → destroy |

## Why two Workers?

Flue's Cloudflare build emits a single auto-generated `_entry.ts` and
doesn't (yet) re-export user-authored `WorkflowEntrypoint` classes
from it. The cleanest workaround is to put the Workflow + the DO that
backs the queue in their own Worker (`runner.ts`), and have the Flue
agent talk to that Worker over a service binding. This also matches
how production Flue + Workflows compositions tend to evolve: the
agent stays thin, the durable backend gets its own deployable unit.

## Extending

The runner executes `kind: 'echo'` tasks for testability. To make this
useful, replace the body of `step.do(\`tick-${tick}\`, …)` in
`runner.ts` with a dispatch on `task.kind` — e.g. call Workers AI,
hit a Hyperdrive Postgres, fan out to a Queue, kick off a child
Workflow. Each task still gets its own durable, retriable step for free.
