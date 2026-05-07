# flue-snippets

Small [Flue](https://flueframework.com) agents that compose with
Cloudflare primitives (DOs, R2, Queues, Workers AI, AI Gateway, Workers
for Platforms) and a few open-source receipt/proof/sandbox/memory
libraries (`@acoyfellow/lab`, `gateproof`, `unsurf`, `capa`).

Each snippet is a runnable Flue agent in 15-40 lines, paired with a real
end-to-end test that deploys an ephemeral Worker, exercises it against
live services, and tears the Worker down. No mocks. No skips.

![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)

## Snippets

| # | Title | Primitives | LOC | E2E |
|---|---|---|---:|---:|
| [01](batch-a/01-lab-receipt) | Run a prompt → get a permalink | Workers AI + lab | 22 | ✅ |
| [03](batch-a/03-gateproof-loop) | Self-healing via gates | gateproof | 22 | |
| [04](batch-a/04-unsurf-trace) | Browser actions as typed traces | unsurf | 24 | |
| [05](batch-a/05-capa-stripe) | Refund without seeing the Stripe key | capa | 26 | |
| [06](batch-b/06-ai-gateway) | Cached, observable, rate-limited prompts | AI Gateway | 15 | |
| [07](batch-b/07-r2-knowledge) | R2 bucket as the agent's filesystem | R2 + VirtualSandbox | 19 | |
| [08](batch-b/08-do-session) | Per-user DO-backed agent sessions | Durable Objects | 12 | ✅ |
| [09](batch-b/09-queue-cron) | Scheduled rig in the cloud, no PID file | Queues + Cron | 22 | |
| [10](batch-b/10-platforms) | Multi-tenant Flue agent host | Workers for Platforms | 22 | |
| [11](batch-c/11-gateway-lab) | Gateway sees traffic, lab sees work | AI Gateway + lab | 29 | |
| [13](batch-c/13-r2-gateproof) | Edit docs in R2, gate the result | Cloudflare Sandbox + gateproof | 29 | |
| [14](batch-c/14-queue-unsurf) | Hourly regression checks with video | Queues + unsurf | 35 | |
| [15](batch-c/15-platforms-capa) | Multi-tenant agents handle money | Workers for Platforms + capa | 37 | |

## Run a snippet's E2E test

Each snippet that ships a `run-e2e.sh` does the same five things:

1. `flue build --target cloudflare` produces the worker module.
2. `alchemy deploy` declares the Worker + DO bindings + vars and
   bundles the worker. URL is captured from stdout.
3. Poll the deployed URL until route propagation finishes.
4. `gateproof.plan.ts` runs against the live URL.
5. `alchemy destroy` tears the worker + state down (always, on exit).

Wrangler is not invoked anywhere in this repo. Alchemy is the system
of record for the resource graph; flue produces the entrypoint module
that alchemy bundles and deploys.

Required env:

```bash
export CLOUDFLARE_API_TOKEN=...    # Workers Scripts:Edit + Workers AI:Read
export CLOUDFLARE_ACCOUNT_ID=...
```

Then:

```bash
bun install
bash batch-a/01-lab-receipt/run-e2e.sh
```

A run takes ~30-60s and costs ~$0.0001-$0.0002 in Workers AI usage.

## CI

`.github/workflows/e2e.yml` is `workflow_dispatch`-only — go to the
[Actions tab](https://github.com/acoyfellow/flue-snippets/actions) and
choose a snippet from the dropdown. Set `CF_API_TOKEN_E2E` and
`CF_ACCOUNT_ID_E2E` as repo secrets.

## License

MIT.
