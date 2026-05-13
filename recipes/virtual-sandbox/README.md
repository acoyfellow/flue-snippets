---
title: virtual-sandbox
tagline: "Mount an R2 bucket as the agent's filesystem and let it grep its way to an answer."
composes: [R2, Workers AI, Durable Objects]
---

# virtual-sandbox

> Mount an R2 bucket as the agent's filesystem and let it grep its way to an answer.

## Composes

- **[Flue](https://flueframework.com)**, `getVirtualSandbox()` mounts a bucket at `/workspace`
- **[R2](https://developers.cloudflare.com/r2/)**, the backing blob store for the virtual filesystem
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, `@cf/moonshotai/kimi-k2.6` as the model
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**, auto-wired by Flue for sandbox metadata + session

## What it proves

- Flue's virtual sandbox actually mounts an R2 bucket as a usable filesystem
- The agent gets bash-like tools (`grep`, `find`, `read`) over the bucket, no container required
- A question whose answer only exists in a seeded R2 doc gets answered correctly
- Zero RAG plumbing, zero embedding pipeline, just files and grep

## Run

```sh
bash recipes/virtual-sandbox/run-e2e.sh
```

The probe POSTs `"what colour is magic?"` to the agent. The fact lives only
in `docs/colours.md` in R2; if the sandbox mount works, the agent greps it
and returns `octarine`.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/virtual-sandbox.ts` | 33 | the snippet, `getVirtualSandbox(env.KB)` + a session |
| `alchemy.run.ts` | 30 | Worker + R2 + AI + DO bindings |
| `gateproof.plan.ts` | 37 | 1 gate: probe asserts the seeded fact surfaces |
| `probe.ts` | 39 | single POST, asserts "octarine" in answer |
| `run-e2e.sh` | 53 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
