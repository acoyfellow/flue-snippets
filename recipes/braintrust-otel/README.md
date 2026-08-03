---
title: braintrust-otel
tagline: 'Export a Workers AI model-operation span to Braintrust through OpenTelemetry.'
composes: [Braintrust, OpenTelemetry, Workers AI]
---

# braintrust-otel

Flue 2 replaces the old request-return operation with `BraintrustOtel` and its `braintrust_otel_prompt` tool. The tool performs the model operation through its harness, wraps it in `BraintrustSpanProcessor`, and bounds the exporter flush before returning its `{ output: ... }` result.

## What it proves

- A durable agent tool surrounds a real Workers AI prompt with a `gen_ai.*` OpenTelemetry span.
- The span records operation metadata and lengths, not prompt or answer content.
- The tool flushes the Braintrust exporter before the conversation settles.
- Client delivery posts to `/agents/braintrust-otel/<conversationId>` and reads the same URL for the settled tool result.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
export BRAINTRUST_PROJECT='flue-snippets'
bash recipes/braintrust-otel/run-e2e.sh
```
