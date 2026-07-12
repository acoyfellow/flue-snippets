---
title: braintrust-eval
tagline: 'Evaluate a deployed Flue endpoint as a Braintrust experiment.'
composes: [Braintrust Evals, Workers AI]
---

# braintrust-eval

> Evaluate a deployed Flue endpoint as a Braintrust experiment.

## Composes

- **[Flue](https://flueframework.com)** and **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, the real system under test
- **[Braintrust evaluations](https://www.braintrust.dev/docs/evaluate/run-evaluations)**, `Eval(...)` over two prompt cases and a small code scorer
- **[gateproof](https://gateproof.dev)**, lifecycle gates around the deployed target and the Braintrust CLI invocation

## What it proves

- `eval.ts` treats a live Flue route as an evaluation task rather than evaluating a mock function.
- The Braintrust CLI runs an experiment with case-level outputs and a `contains_requested_word` score.
- Gateproof asserts that target calls and the experiment invocation complete. Inspect the Braintrust
  experiment to review score values; this harness does not present them as release thresholds.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'

bash recipes/braintrust-eval/run-e2e.sh
```

Unlike the tracing and gateway recipes, the Braintrust key remains with the local `braintrust eval`
process; it is not installed in the deployed Worker.

## Files

| File | Role |
|---|---|
| `agents/braintrust-eval.ts` | Workers AI endpoint evaluated as the system under test |
| `eval.ts` | Braintrust dataset, task fetch, and code scorer |
| `alchemy.run.ts` | ephemeral Worker and AI/DO bindings |
| `gateproof.plan.ts` / `probe.ts` | live-target preflight plus experiment command gate |
| `run-e2e.sh` | build, deploy, warm, evaluate, destroy lifecycle |
