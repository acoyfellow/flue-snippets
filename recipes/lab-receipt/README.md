---
title: lab-receipt
tagline: 'Run a prompt → get a permalink. The receipt is the artifact.'
composes: [Workers AI, lab]
---

# lab-receipt

> Run a prompt → get a permalink. The receipt is the artifact.

## Composes

- **[Flue](https://flueframework.com)** — the agent shape (`init` → `session` → `prompt`)
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — `@cf/meta/kimi-k2.6` for the model call
- **[`@acoyfellow/lab`](https://lab.coey.dev)** — `createReceipt({...})` for the audit trail

## What it proves

- A Flue agent deployed as a Cloudflare Worker returns a real model answer
- The same call writes a Lab receipt (input + output + capabilities) to `lab.coey.dev`
- That receipt URL is fetchable from anywhere — past the request, past the agent

## Run

```sh
bash recipes/lab-receipt/run-e2e.sh
```

Requires `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + Workers AI:Read) and
`CLOUDFLARE_ACCOUNT_ID` in env.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/lab-receipt.ts` | 22 | the snippet |
| `alchemy.run.ts` | 27 | resource graph (Worker + DO + vars) |
| `gateproof.plan.ts` | 47 | 2 gates: agent route + lab origin |
| `probe.ts` | 35 | pure fetch + JSON assertion |
| `run-e2e.sh` | 80 | build → deploy → warmup → gateproof → destroy |
