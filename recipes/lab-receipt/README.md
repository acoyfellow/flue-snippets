---
title: lab-receipt
tagline: 'A prompt response and its Lab receipt are one tool result.'
composes: [Workers AI, lab]
---

# lab-receipt

The `prompt_with_receipt` tool runs the delivered prompt through the agent harness and persists its input and output with `@acoyfellow/lab`. The returned receipt permalink is the durable audit artifact.

## Route

`POST /agents/lab-receipt/<conversationId>` returns HTTP 202. Poll `GET` on the same URL until the response contains the answer and receipt.

## Run

```sh
bash recipes/lab-receipt/run-e2e.sh
```
