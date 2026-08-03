---
title: braintrust-eval
tagline: 'Evaluate a deployed Flue 2 agent as a Braintrust experiment.'
composes: [Braintrust Evals, Workers AI]
---

# braintrust-eval

The former request-return operation is now the `BraintrustEval` agent. `eval.ts` creates a conversation URL for every case, posts `{ "kind": "user", "body": "..." }`, waits for `202`, and polls `GET` on the same URL for the assistant text that Braintrust scores.

## What it proves

- Braintrust evaluates a deployed Workers AI agent rather than a mock function.
- Every evaluation case uses Flue 2 admission and conversation snapshots.
- The local Braintrust CLI keeps `BRAINTRUST_API_KEY`; the deployed Worker does not receive that credential.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
bash recipes/braintrust-eval/run-e2e.sh
```
