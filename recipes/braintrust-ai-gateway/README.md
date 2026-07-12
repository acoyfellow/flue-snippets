---
title: braintrust-ai-gateway
tagline: 'Call a provider through the hosted Braintrust AI Gateway from a Flue agent.'
composes: [Braintrust AI Gateway]
---

# braintrust-ai-gateway

> Call a provider through the hosted Braintrust AI Gateway from a Flue agent.

## Composes

- **[Flue](https://flueframework.com)**, a webhook-shaped Worker endpoint
- **[Braintrust AI Gateway](https://www.braintrust.dev/docs/deploy/gateway)**, its OpenAI-compatible `POST /chat/completions` API, provider routing, and request logging

## What it proves

- A Flue Worker calls `https://gateway.braintrust.dev/chat/completions` using only a
  server-side Braintrust credential.
- Setting `x-bt-parent: project_name:<project>` causes the gateway to return the documented
  `x-bt-span-id` logging signal; the probe asserts that signal rather than claiming dashboard
  evidence it did not inspect.
- No provider key is installed in the Worker. Configure the selected provider in Braintrust.

## Run

Before running, add a provider credential for the model in Braintrust (organization-level or
project-level AI Providers settings).

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
export ALCHEMY_PASSWORD='<local-state-encryption-password>'
export BRAINTRUST_PROJECT='flue-snippets' # optional
export BRAINTRUST_MODEL='gpt-4o-mini'      # optional; provider must be configured

bash recipes/braintrust-ai-gateway/run-e2e.sh
```

The secret becomes an encrypted Worker binding via `alchemy.secret(...)`; the recipe never emits
it in its response or logs.

## Files

| File | Role |
|---|---|
| `agents/braintrust-ai-gateway.ts` | OpenAI-compatible gateway request and logging header |
| `alchemy.run.ts` | Worker/DO and encrypted credential binding |
| `gateproof.plan.ts` / `probe.ts` | live answer and `x-bt-span-id` assertion |
| `run-e2e.sh` | build, deploy, warm, assert, destroy lifecycle |
