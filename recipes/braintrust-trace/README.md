---
title: braintrust-trace
tagline: 'Trace a Workers AI model operation in Braintrust from a Flue 2 agent tool.'
composes: [Braintrust, Workers AI]
---

# braintrust-trace

Flue 2 replaces the old request-return operation with `BraintrustTrace` and its `braintrust_traced_prompt` tool. The tool calls Workers AI through its harness inside `initLogger(...).traced(...)`, logs the request and response to the span, then flushes before it returns `{ output: ... }`.

## What it proves

- A durable agent tool records a real Workers AI prompt in a Braintrust application trace.
- The Braintrust flush completes before the conversation response settles.
- The agent uses the server-side `BRAINTRUST_API_KEY` without returning it.
- Client delivery posts to `/agents/braintrust-trace/<conversationId>` and reads the same URL for the completed result.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
export BRAINTRUST_PROJECT='flue-snippets'
bash recipes/braintrust-trace/run-e2e.sh
```
