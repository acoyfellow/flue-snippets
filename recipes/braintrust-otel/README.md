---
title: braintrust-otel
tagline: 'Export a Flue model-operation span to Braintrust through OpenTelemetry.'
composes: [Braintrust, OpenTelemetry, Workers AI]
---

# braintrust-otel

> Export a Flue model-operation span to Braintrust through OpenTelemetry.

## Composes

- **[Flue](https://flueframework.com)** and **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, the deployed operation
- **[`@braintrust/otel`](https://www.braintrust.dev/docs/integrations/sdk-integrations/opentelemetry)**, the supported `BraintrustSpanProcessor`
- **OpenTelemetry JS**, a request-scoped `BasicTracerProvider` and `gen_ai.*` attributes

## What it proves

- A Cloudflare-hosted Flue request can emit an OTel AI span and synchronously flush the
  Braintrust processor before the Worker response completes.
- `filterAISpans: true` retains the deliberately named `gen_ai.flue.workers_ai.prompt` span.
- This example exports timing/model/length metadata only, not prompt or answer content.

The probe verifies the model response and completed exporter path. Actual receipt and presentation
of spans must be checked in the configured Braintrust project after a credentialed run.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
export BRAINTRUST_PROJECT='flue-snippets' # optional
export ALCHEMY_PASSWORD='<local-state-encryption-password>'

bash recipes/braintrust-otel/run-e2e.sh
```

`alchemy.secret(...)` protects the credential in Worker bindings/state; it is never returned by
the agent.

## Files

| File | Role |
|---|---|
| `agents/braintrust-otel.ts` | manual OTel AI span around a Workers AI request |
| `alchemy.run.ts` | Worker/AI/DO and encrypted credential binding |
| `gateproof.plan.ts` / `probe.ts` | response and exporter-path assertion |
| `run-e2e.sh` | build, deploy, warm, assert, destroy lifecycle |
