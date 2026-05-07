# flue-snippets

Small [Flue](https://flueframework.com) agents that compose with Cloudflare
primitives (Durable Objects, AI Gateway, Workers AI) and a couple of open
source receipt/proof libraries (`@acoyfellow/lab`, `gateproof`).

Each snippet is a runnable Flue agent in 10-40 lines, paired with a real
end-to-end test that deploys an ephemeral Worker, exercises it against
live services, then tears the Worker down. **No mocks. No skips.**

![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)

## Run a snippet in 5 minutes

```sh
git clone https://github.com/acoyfellow/flue-snippets
cd flue-snippets
bun install

# Workers Scripts:Edit + Workers AI:Read on a CF API token
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

bash snippets/lab-receipt/run-e2e.sh
```

You get a Worker URL deployed to your account, real model output, a real
[Lab](https://lab.coey.dev) receipt, then the Worker is destroyed. Run
takes ~60-90 seconds and costs about $0.0001 in Workers AI usage.

## Snippets

Every folder is a complete, runnable example. Open `agents/<name>.ts` for
the snippet itself; the rest of the folder is the harness.

| Snippet | Composes |
|---|---|
| [lab-receipt](snippets/lab-receipt) | Workers AI + lab |
| [do-session](snippets/do-session) | Durable Objects |
| [do-governor](snippets/do-governor) | Durable Objects |
| [lab-checkpoint](snippets/lab-checkpoint) | Durable Objects + lab |
| [ai-gateway](snippets/ai-gateway) | AI Gateway + Workers AI |
| [gateway-lab](snippets/gateway-lab) | AI Gateway + Workers AI + lab |

Each snippet's README is a one-page reference card: what it composes, what
it proves, and how to run it.

## How the harness works

Every `run-e2e.sh` does the same five things:

1. **`flue build --target cloudflare`** produces `_entry.ts` — a worker
   module plus a Durable Object class per agent.
2. **`alchemy deploy`** declares the Worker, bindings, and vars in
   [`alchemy.run.ts`](snippets/lab-receipt/alchemy.run.ts), bundles
   `_entry.ts`, and prints the worker URL.
3. **Warmup** polls `/health` then POSTs `/agents/<name>/warmup` with
   retries — this absorbs the route-propagation race AND the Workers AI
   cold start (which can be 30-60s on a fresh isolate).
4. **`gateproof.plan.ts`** runs the snippet's gates against the live URL.
   Each gate's act is `bun run probe.ts` — a small TypeScript program
   that does pure `fetch` + JSON. No bash heredocs, no python parsers
   (those broke on multi-line model output).
5. **`alchemy destroy`** tears the worker, bindings, and state down.
   Trapped on `EXIT INT TERM` so the cleanup runs even if a gate fails.

Wrangler is not invoked anywhere in this repo — alchemy is the system of
record for the resource graph; flue produces the entrypoint module that
alchemy bundles.

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) runs on
`workflow_dispatch` only. Pick `all` or a single snippet from the dropdown
in the [Actions tab](https://github.com/acoyfellow/flue-snippets/actions).
Matrix is `max-parallel: 1` because Workers AI on a personal account
rate-limits hard under parallel load.

Required repo secrets:

- `CF_API_TOKEN_E2E` — Workers Scripts:Edit + Workers AI:Read
- `CF_ACCOUNT_ID_E2E` — account ID

## License

MIT.
