# flue-snippets

Small [Flue](https://flueframework.com) agents that compose with Cloudflare
primitives (Durable Objects, R2, Workers AI, AI Gateway, Workflows) and a
few open-source receipt/proof libraries (`@acoyfellow/lab`, `gateproof`).

Each snippet is a runnable Flue agent in 15-40 lines, paired with a real
end-to-end test that deploys an ephemeral Worker, exercises it against
live services, then tears the Worker down. **No mocks. No skips.**

![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)

## Run a snippet

```sh
git clone https://github.com/acoyfellow/flue-snippets
cd flue-snippets
bun install

# Required env (Cloudflare Workers Scripts:Edit + Workers AI:Read)
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

bash snippets/lab-receipt/run-e2e.sh
```

The harness does five things every time:

1. `flue build --target cloudflare` produces the worker module.
2. `alchemy deploy` declares the Worker + bindings + vars and bundles.
3. Polls the deployed URL until route propagation finishes.
4. Runs `gateproof.plan.ts` against the live URL.
5. `alchemy destroy` tears it all down (always, on exit).

A run takes ~30-60s and costs ~$0.0001 per snippet in Workers AI usage.
Wrangler is not invoked anywhere — alchemy is the system of record for
the resource graph; flue produces the entrypoint module that alchemy
bundles and deploys.

## Snippets

Each folder under [`snippets/`](./snippets) is a complete, runnable
example. Open the snippet's `agents/<name>.ts` for the agent code and
`README.md` for what it proves.

| Snippet | Composes | Status |
|---|---|---|
| [lab-receipt](snippets/lab-receipt) | Workers AI + lab | ✅ |
| [do-session](snippets/do-session) | Durable Objects | ✅ |
| [do-governor](snippets/do-governor) | Durable Objects | ✅ |
| [lab-checkpoint](snippets/lab-checkpoint) | Durable Objects + lab | ✅ |
| [ai-gateway](snippets/ai-gateway) | AI Gateway + Workers AI | ✅ |
| [gateway-lab](snippets/gateway-lab) | AI Gateway + Workers AI + lab | ✅ |
| [r2-knowledge](snippets/r2-knowledge) | R2 + Workers AI | 🚧 |
| [capa-stripe](snippets/capa-stripe) | Service binding + lab | 🚧 |
| [r2-gateproof](snippets/r2-gateproof) | Cloudflare Sandbox (containers) + gateproof | 🚧 |

✅ = E2E green locally and on CI · 🚧 = scaffolded, harness in progress

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) runs on
`workflow_dispatch` only. Choose `all` or a single snippet from the
dropdown in the [Actions tab](https://github.com/acoyfellow/flue-snippets/actions).

Required repo secrets:

- `CF_API_TOKEN_E2E` — token with Workers Scripts:Edit + Workers AI:Read
- `CF_ACCOUNT_ID_E2E` — account ID

## License

MIT.
