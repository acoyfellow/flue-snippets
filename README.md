# flue-snippets

Real, runnable [Flue](https://flueframework.com) agents on
[Cloudflare](https://developers.cloudflare.com/workers/). Two folders,
one purpose: **show what Flue + Cloudflare looks like for real.**

[![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml)

```text
examples/   one CF product, smallest Flue agent that uses it
recipes/    compositions — multiple primitives working together
```

Every snippet ships with an end-to-end test that **deploys a real
ephemeral Worker, exercises it against live services, then tears the
Worker down**. No mocks, no skips.

## Run a snippet in 5 minutes

```sh
git clone https://github.com/acoyfellow/flue-snippets
cd flue-snippets
bun install

# Create a CF API token at https://dash.cloudflare.com/profile/api-tokens
# (Workers Scripts:Edit + Workers AI:Read are the minimum)
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

bash examples/workers-ai/run-e2e.sh
```

A run takes ~30–60 seconds and costs about $0.0001 in Workers AI usage.
A real Worker is deployed to your account, hit, then destroyed. If a
gate fails, the cleanup still runs.

## Examples — one CF product per folder

Each folder is the smallest Flue agent that exercises one Cloudflare
binding. Read them in any order.

| Example | Cloudflare product |
|---|---|
| [workers-ai](examples/workers-ai) | [Workers AI](https://developers.cloudflare.com/workers-ai/) |
| [kv](examples/kv) | [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) |
| [r2](examples/r2) | [R2](https://developers.cloudflare.com/r2/) |
| [d1](examples/d1) | [D1](https://developers.cloudflare.com/d1/) |
| [durable-objects](examples/durable-objects) | [Durable Objects](https://developers.cloudflare.com/durable-objects/) |
| [ai-gateway](examples/ai-gateway) | [AI Gateway](https://developers.cloudflare.com/ai-gateway/) |
| [queues](examples/queues) | [Queues](https://developers.cloudflare.com/queues/) |
| [vectorize](examples/vectorize) | [Vectorize](https://developers.cloudflare.com/vectorize/) |
| [browser-rendering](examples/browser-rendering) | [Browser Rendering](https://developers.cloudflare.com/browser-rendering/) |

## Recipes — compositions

Each recipe combines Flue with a Cloudflare primitive **and** an
open-source receipt or proof library
([`@acoyfellow/lab`](https://www.npmjs.com/package/@acoyfellow/lab) or
[`gateproof`](https://gateproof.dev)) to show what production-shape
agents look like.

| Recipe | Composes |
|---|---|
| [lab-receipt](recipes/lab-receipt) | Workers AI + lab |
| [do-session](recipes/do-session) | Durable Objects |
| [do-governor](recipes/do-governor) | Durable Objects |
| [lab-checkpoint](recipes/lab-checkpoint) | Durable Objects + lab |
| [ai-gateway](recipes/ai-gateway) | AI Gateway + Workers AI |
| [gateway-lab](recipes/gateway-lab) | AI Gateway + Workers AI + lab |

Each recipe README is a one-page reference card: what it composes, what
it proves, how to run it.

## End-to-end flow

Every `run-e2e.sh` orchestrates the same five-step lifecycle:

1. **`flue build --target cloudflare`** produces `_entry.ts` — a Worker
   module plus a Durable Object class per agent.
2. **`alchemy deploy`** ([`alchemy.run.ts`](examples/workers-ai/alchemy.run.ts))
   declares the Worker, bindings, and vars; bundles the entry; prints
   the URL.
3. **Warmup** polls `/health` then POSTs `/agents/<name>/warmup` with
   retries — absorbing the route-propagation race AND the Workers AI
   cold start (which can be 30–60s on a fresh isolate).
4. **Assert** — examples do an inline curl-and-grep; recipes run a
   `gateproof.plan.ts` with a dedicated `probe.ts` (pure `fetch` + JSON,
   no bash heredocs, no Python parsers).
5. **`alchemy destroy`** tears the Worker, bindings, and state down.
   Trapped on `EXIT INT TERM` so cleanup runs even if a gate fails.

Wrangler is not invoked anywhere in this repo —
[alchemy](https://alchemy.run) is the system of record for the resource
graph; Flue produces the entrypoint module that alchemy bundles.

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) is
`workflow_dispatch`-only. From the
[Actions tab](https://github.com/acoyfellow/flue-snippets/actions),
choose `all`, `examples`, `recipes`, or any single target from the
dropdown. Matrix is `max-parallel: 1` because Workers AI rate-limits
hard under parallel load on a personal account.

Required repo secrets:

- `CF_API_TOKEN_E2E` — Workers Scripts:Edit + Workers AI:Read (plus
  any product-specific perms used by the matrix entries you enable —
  R2 / D1 / KV / Queues / AI Gateway / Vectorize / Browser Rendering)
- `CF_ACCOUNT_ID_E2E` — Cloudflare account ID

## Local scripts

Equivalent to running each `run-e2e.sh` directly:

```sh
bun ex:workers-ai   # examples/workers-ai
bun ex:kv           # examples/kv
bun ex:r2           # examples/r2
# … see package.json for the full list
bun rx:lab-receipt  # recipes/lab-receipt
# …
```

## License

[MIT](LICENSE).
