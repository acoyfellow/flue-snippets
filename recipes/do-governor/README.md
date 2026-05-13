---
title: do-governor
tagline: 'Persistent run state that changes the next action when the agent loops.'
composes: [Durable Objects]
---

# do-governor

> Persistent run state that changes the next action when the agent loops.

## Composes

- **[Flue](https://flueframework.com)**, agent shape
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**, per-user DO holds the run governor state
- **`govern()`**, a tiny pure-function policy that turns "5 of the same `lastAction` in a row" into `reanchor` then `ask-human`

## What it proves

- A Flue agent records cycle count, recent actions, and a stuck score
- After 3 repeats of the same `lastAction`, decision flips from `continue` → `reanchor`
- After 4+ repeats, it escalates to `ask-human`
- The 5-turn probe shows the full progression: `continue → continue → reanchor → ask-human → ask-human`

## Run

```sh
bash recipes/do-governor/run-e2e.sh
```

Two gates: a single first-turn POST + a 5-turn loop in `probe.ts` that
asserts the governor escalates.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/do-governor.ts` | 38 | the snippet (`govern()` + handler) |
| `alchemy.run.ts` | 24 | Worker + DO binding |
| `gateproof.plan.ts` | 67 | 2 gates: first-call + escalation loop |
| `probe.ts` | 65 | 5-turn loop, asserts escalation away from `continue` |
| `run-e2e.sh` | 53 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
