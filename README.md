# flue-snippets

Real, runnable [Flue](https://flueframework.com) agents on
[Cloudflare](https://developers.cloudflare.com/workers/). Every snippet
deploys a real ephemeral Worker, exercises it against live services,
then tears it down. No mocks.

[![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml)

> Demo site: [flue.coey.dev](https://flue.coey.dev), a guided tour of Flue on Cloudflare, auto-generated from this repo.

```text
examples/   one CF product per folder, smallest Flue agent that uses it
recipes/    compositions, Flue + multiple primitives + receipts/proofs
templates/  forkable starters, production-shape, fork-and-ship
```

## Run one

```sh
git clone https://github.com/acoyfellow/flue-snippets
cd flue-snippets
bun install         # or: npm install

# https://dash.cloudflare.com/profile/api-tokens, Workers Scripts:Edit + Workers AI:Read
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

bun ex:workers-ai   # or: npm run ex:workers-ai
```

~60 seconds: deploy, run, assert, destroy. ~$0.0001 in Workers AI usage.

The agent it just ran:

```ts
// examples/workers-ai/workers-ai.ts
import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext) {
  const out = await env.AI.run('@cf/moonshotai/kimi-k2.6', {
    prompt: payload.message ?? 'Say hi.',
  });
  return { answer: out.response };
}
```

## Examples

One Flue agent, one Cloudflare binding.

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
| [worker-loader](examples/worker-loader) | [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/) |
| [hyperdrive](examples/hyperdrive) | [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| [email-workers](examples/email-workers) | [Email Service](https://developers.cloudflare.com/email-service/) |

## Recipes

Flue + a Cloudflare primitive + an open-source receipt/proof layer
([`@acoyfellow/lab`](https://www.npmjs.com/package/@acoyfellow/lab),
[`gateproof`](https://gateproof.dev)).

| Recipe | Composes |
|---|---|
| [lab-receipt](recipes/lab-receipt) | Workers AI + lab |
| [do-session](recipes/do-session) | Durable Objects |
| [do-governor](recipes/do-governor) | Durable Objects |
| [lab-checkpoint](recipes/lab-checkpoint) | Durable Objects + lab |
| [ai-gateway](recipes/ai-gateway) | AI Gateway + Workers AI |
| [gateway-lab](recipes/gateway-lab) | AI Gateway + Workers AI + lab |
| [github-triage](recipes/github-triage) | Workers AI + Flue skills (structured output) |
| [chat-thinking](recipes/chat-thinking) | Flue + [Cloudflare Think](https://developers.cloudflare.com/agents/api-reference/think/) (DO chat agent) |
| [virtual-sandbox](recipes/virtual-sandbox) | Flue virtual sandbox + R2 |
| [mcp-client](recipes/mcp-client) | Flue + co-hosted MCP server (Workers) |
| [dynamic-workflow](recipes/dynamic-workflow) | Durable Objects + [Workflows](https://developers.cloudflare.com/workflows/) |

Each recipe's README explains what it composes, what it proves, how to run it.

## Local scripts

```sh
bun ex:<name>    # examples/<name>/run-e2e.sh
bun rx:<name>    # recipes/<name>/run-e2e.sh
bun tpl:<name>   # templates/<name>/run-e2e.sh
```

See [`package.json`](package.json) for the full list.

## End-to-end flow

Every `run-e2e.sh` does the same five things:

1. `flue build --target cloudflare`, emits the Worker entrypoint + per-agent DO classes.
2. `alchemy deploy`, declares the Worker, bindings, and vars; bundles; prints the URL.
3. Warmup, polls `/health`, then POSTs `/agents/<name>/warmup` with retries (absorbs route propagation + Workers AI cold start).
4. Assert, examples curl-and-grep; recipes run a `gateproof.plan.ts` with a `probe.ts` (pure `fetch` + JSON).
5. `alchemy destroy`, tears the Worker, bindings, and state down. Trapped on `EXIT INT TERM`.

Wrangler is not invoked. [alchemy](https://alchemy.run) owns the resource graph; Flue emits the entrypoint module that alchemy bundles.

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) is `workflow_dispatch`-only. From the [Actions tab](https://github.com/acoyfellow/flue-snippets/actions), pick `all`, `examples`, `recipes`, `templates`, or a single target. `max-parallel: 1` because Workers AI rate-limits hard under parallel load on a personal account.

Secrets:

- `CF_API_TOKEN_E2E`, Workers Scripts:Edit + Workers AI:Read, plus permissions for any product-specific targets you enable (R2 / D1 / KV / Queues / AI Gateway / Vectorize / Browser Rendering / Worker Loader / Hyperdrive / Email).
- `CF_ACCOUNT_ID_E2E`, Cloudflare account ID.
- `EMAIL_FROM`, `EMAIL_TO`, only needed if you enable `examples/email-workers`. Without them, the send call returns a structured error and the assertion still passes (it accepts either a real send or a structured `E_*` code).

## FAQ

**Does it really deploy?** Yes. Each `run-e2e.sh` calls `alchemy deploy`, hits a real `*.workers.dev` URL, then `alchemy destroy`s it. CI does the same. There is no mock layer.

**What does it cost?** ~$0.0001 per snippet per run (Workers AI llama-scout call). Free tier is plenty for the entire matrix.

**Why no wrangler?** [alchemy](https://alchemy.run) is the resource graph (Workers + bindings + vars, declared in TypeScript, with destroy). Flue is the agent runtime (emits the Worker entrypoint module). The two compose cleanly; wrangler would duplicate alchemy's job.

**Why does CI run sequentially?** Workers AI rate-limits aggressively on personal accounts under parallel load. `max-parallel: 1` keeps the matrix green.

**Can I run only one?** Yes, every example, recipe, and template is independent. `bun ex:<name>`, `bun rx:<name>`, or `bun tpl:<name>`. Or trigger a single target from the Actions dropdown.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE).
