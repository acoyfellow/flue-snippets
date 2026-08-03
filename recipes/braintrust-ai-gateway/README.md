---
title: braintrust-ai-gateway
tagline: 'Call a provider through the hosted Braintrust AI Gateway from a durable Flue agent tool.'
composes: [Braintrust AI Gateway, Workers AI]
---

# braintrust-ai-gateway

The old request-shaped operation is a Flue 2 agent plus `braintrust_gateway_completion`. The agent's Workers AI turn chooses the tool, and the tool calls the OpenAI-compatible Braintrust gateway with the `x-bt-parent` logging header.

## What it proves

- A Worker-side tool sends a completion to the configured Braintrust gateway.
- The gateway request uses the server-side `BRAINTRUST_API_KEY` and does not return or log it.
- The tool returns its result in the required `{ output: ... }` envelope and records whether `x-bt-span-id` was returned.
- Client delivery is asynchronous: post to `/agents/braintrust-ai-gateway/<conversationId>`, then read that same conversation URL.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
bash recipes/braintrust-ai-gateway/run-e2e.sh
```

Configure the selected provider in Braintrust before running the deploy harness.
