---
title: braintrust-trace
tagline: 'Trace a Flue prompt in Braintrust while the model stays on Workers AI.'
composes: [Braintrust, Workers AI]
---

# braintrust-trace

> Trace a Flue prompt in Braintrust while the model stays on Workers AI.

## Composes

- **[Flue](https://flueframework.com)**, the deployed agent request boundary
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, the model call via `env.AI`
- **[Braintrust tracing](https://www.braintrust.dev/docs/instrument/trace-application-logic)**, `initLogger(...).traced(...)` and an explicit `flush()` before a Worker response

## What it proves

- A deployed Flue agent can wrap its real Workers AI request in a Braintrust span.
- A short request/response trace is flushed while the Cloudflare Worker is still alive.
- The E2E probe validates the real model response and completed export path. The final trace's
  appearance and contents remain evidence to review in the configured Braintrust project.

This recipe deliberately records prompt and answer content. Redact or omit content before adapting
it to workloads containing secrets or personal data.

## Review note: Flue observability API generation

Existing snippets in this repository import `FlueContext` from `@flue/sdk/client`, but installed
Flue `0.7` now exposes that agent type from `@flue/runtime` and deprecates the SDK subpath. These
new recipes use the current runtime type without widening this change into a repository migration.
The current Braintrust SDK also exports `braintrustFlueObserver` for Flue's `observe(...)` event
surface. This example deliberately uses manual tracing around the existing generated-worker shape;
review the broader Flue migration separately if native event-to-span mapping is the intended final
surface.

## Run

```sh
export CLOUDFLARE_API_TOKEN='<workers-token>'
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export BRAINTRUST_API_KEY='<braintrust-service-token-or-api-key>'
export BRAINTRUST_PROJECT='flue-snippets' # optional
export ALCHEMY_PASSWORD='<local-state-encryption-password>'

bash recipes/braintrust-trace/run-e2e.sh
```

`ALCHEMY_PASSWORD` is required because `alchemy.run.ts` installs the Braintrust credential as an
encrypted Worker secret binding. Nothing in the probe reads that credential back.

## Files

| File | Role |
|---|---|
| `agents/braintrust-trace.ts` | Workers AI prompt wrapped by a Braintrust span |
| `alchemy.run.ts` | Worker, AI/DO bindings, encrypted Braintrust binding |
| `gateproof.plan.ts` / `probe.ts` | live response and flush-path assertion |
| `run-e2e.sh` | build, deploy, warm, assert, destroy lifecycle |
