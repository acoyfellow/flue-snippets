# flue-snippets

Real, runnable [Flue](https://flueframework.com) agents, workflows, and
channels on [Cloudflare](https://developers.cloudflare.com/workers/). Every
snippet builds with `flue build`, deploys a real ephemeral Worker with
`wrangler`, exercises it against live services, then deletes it. No mocks.

Built for **Flue 1.0** (`@flue/* 1.0.0-beta`). Each snippet is a self-contained
Cloudflare app: its own `package.json`, `wrangler.jsonc`, and `src/`
(`agents/`, `workflows/`, `channels/`).

[![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml/badge.svg)](https://github.com/acoyfellow/flue-snippets/actions/workflows/e2e.yml)

> Demo site: [flue.coey.dev](https://flue.coey.dev), a guided tour of Flue on Cloudflare, auto-generated from this repo.

```text
examples/   one CF product per folder, the smallest Flue snippet that uses it
recipes/    compositions, Flue + multiple primitives + receipts/proofs
templates/  forkable starters, production-shape, fork-and-ship
```

Most snippets are Flue **workflows** (finite `input → result`, invoked at
`POST /workflows/<name>?wait=result`). Snippets that need continuing per-user
state are **agents** (`POST /agents/<name>/<id>`), and verified provider webhook
ingress uses **channels** (`POST /channels/<name>/<suffix>`).

## Run one

```sh
git clone https://github.com/acoyfellow/flue-snippets
cd flue-snippets

# https://dash.cloudflare.com/profile/api-tokens, Workers Scripts:Edit + Workers AI:Read
# Put them in .env (each run-e2e.sh sources it) or export them:
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

bun ex:workers-ai        # from the repo root
# or: cd examples/workers-ai && bash run-e2e.sh
```

~60 seconds: install (first run), build, deploy, assert, delete. ~$0.0001 in
Workers AI usage. Each snippet is self-contained (its own `package.json` +
`src/` + `wrangler.jsonc`) and installs its own deps on first run.

The workflow it just ran:

```ts
// examples/workers-ai/src/workflows/workers-ai.ts
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(input.message ?? 'Say hi.');
    return { answer: response.text };
  },
});
```

Invoke it at `POST /workflows/workers-ai?wait=result` with `{ "message": "..." }`.

## Examples

One Flue snippet, one Cloudflare binding.

| Example | Cloudflare product |
|---|---|
| [workers-ai](examples/workers-ai) | [Workers AI](https://developers.cloudflare.com/workers-ai/) |
| [effect-hello](examples/effect-hello) | [Workers AI](https://developers.cloudflare.com/workers-ai/) + [Effect v4](https://github.com/Effect-TS/effect-smol) (smallest Flue workflow whose body is an Effect program) |
| [kv](examples/kv) | [Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) |
| [r2](examples/r2) | [R2](https://developers.cloudflare.com/r2/) |
| [d1](examples/d1) | [D1](https://developers.cloudflare.com/d1/) |
| [durable-objects](examples/durable-objects) | [Durable Objects](https://developers.cloudflare.com/durable-objects/) (agent: same id → same DO, isolated per instance) |
| [ai-gateway](examples/ai-gateway) | [AI Gateway](https://developers.cloudflare.com/ai-gateway/) |
| [queues](examples/queues) | [Queues](https://developers.cloudflare.com/queues/) |
| [vectorize](examples/vectorize) | [Vectorize](https://developers.cloudflare.com/vectorize/) |
| [browser-rendering](examples/browser-rendering) | [Browser Rendering](https://developers.cloudflare.com/browser-rendering/) |
| [worker-loader](examples/worker-loader) | [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/) |
| [hyperdrive](examples/hyperdrive) | [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) |
| [email-workers](examples/email-workers) | [Email Service](https://developers.cloudflare.com/email-service/) |

## Recipes

Flue compositions with Cloudflare primitives and reviewable receipt, evaluation, or observability
layers (including [`@acoyfellow/lab`](https://www.npmjs.com/package/@acoyfellow/lab),
[`gateproof`](https://gateproof.dev), and [Braintrust](https://www.braintrust.dev/)).

| Recipe | Composes |
|---|---|
| [lab-receipt](recipes/lab-receipt) | Workers AI + lab |
| [do-session](recipes/do-session) | Durable Objects (agent, durable session memory) |
| [do-governor](recipes/do-governor) | Durable Objects (workflow, repetition governor) |
| [lab-checkpoint](recipes/lab-checkpoint) | Durable Objects + lab |
| [ai-gateway](recipes/ai-gateway) | AI Gateway + Workers AI |
| [gateway-lab](recipes/gateway-lab) | AI Gateway + Workers AI + lab |
| [github-triage](recipes/github-triage) | Workers AI + structured output ([valibot](https://valibot.dev) schema) |
| [chat-thinking](recipes/chat-thinking) | Flue + [Cloudflare Think](https://developers.cloudflare.com/agents/api-reference/think/) (co-hosted DO chat agent) |
| [virtual-sandbox](recipes/virtual-sandbox) | Flue virtual sandbox (just-bash) + R2 |
| [mcp-client](recipes/mcp-client) | Flue + co-hosted MCP server (Workers) |
| [dynamic-workflow](recipes/dynamic-workflow) | Durable Objects + [Workflows](https://developers.cloudflare.com/workflows/) |
| [event-trigger](recipes/event-trigger) | Workers AI + structured output (one signed-webhook front door for Sentry / PagerDuty / GitLab CI / cron) |
| [braintrust-trace](recipes/braintrust-trace) | Braintrust application tracing + Workers AI |
| [braintrust-ai-gateway](recipes/braintrust-ai-gateway) | Braintrust AI Gateway + gateway logging |
| [braintrust-eval](recipes/braintrust-eval) | Braintrust Evals + deployed Workers AI endpoint |
| [braintrust-otel](recipes/braintrust-otel) | OpenTelemetry + Braintrust span exporter + Workers AI |

Each recipe's README explains what it composes, what it proves, and how to run it. The Braintrust
recipes require a `BRAINTRUST_API_KEY` (injected into the ephemeral Worker via
`wrangler deploy --var`); they run explicitly with `bun rx:braintrust-*` rather than in the CI
matrix. No `ALCHEMY_PASSWORD` — deploys use wrangler, not alchemy.

## Local scripts

```sh
bun ex:<name>    # examples/<name>/run-e2e.sh
bun rx:<name>    # recipes/<name>/run-e2e.sh
bun tpl:<name>   # templates/<name>/run-e2e.sh
```

See [`package.json`](package.json) for the full list.

## Refresh dependencies

```sh
bun run update
```

That repeatable maintenance command runs `bun update` in the repo and in
[`site/`](site), refreshes the homepage's visible “Last dependency refresh”
timestamp when Bun bumps package manifest versions, then runs the site production
build. If the Flue CLI/runtime or a dependency used by a snippet changes shape,
also update the affected example/recipe/template and run its live E2E (`bun
ex:<name>`, `bun rx:<name>`, or `bun tpl:<name>`) before shipping.

## End-to-end flow

Every `run-e2e.sh` does the same five things:

1. `flue build --target cloudflare`, compiles the project (agents/workflows/channels
   under `src/`) into `dist/<name>/` with a Flue-generated `wrangler.json`.
2. `wrangler deploy --config dist/<name>/wrangler.json`, deploys the Worker,
   creating any per-run resource (KV/R2/D1/Queue/Vectorize) first and injecting
   secrets/vars with `--var`. Prints the URL.
3. Warmup, POSTs the workflow route (`/workflows/<name>?wait=result`) or agent
   route (`/agents/<name>/<id>`) with retries (absorbs route propagation + Workers
   AI cold start). Flue 1.0 has no `/health` route.
4. Assert, workflows read `{ result }` from `?wait=result`; agents read the
   conversation snapshot at `?view=history`; recipes run a `gateproof.plan.ts`
   with a `probe.ts` (pure `fetch` + JSON).
5. `wrangler delete` (and delete any created resource), then verify zero leftover
   Workers. Trapped on `EXIT INT TERM`.

Flue owns the wrangler config: `flue build` merges its generated bindings +
migrations into `dist/<name>/wrangler.json`, and `wrangler deploy` ships it. Each
snippet is self-contained — its own `package.json`, `wrangler.jsonc`, and `src/`.

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) is `workflow_dispatch`-only. From the [Actions tab](https://github.com/acoyfellow/flue-snippets/actions), pick `all`, `examples`, `recipes`, `templates`, or a single target. `max-parallel: 1` because Workers AI rate-limits hard under parallel load on a personal account.

Secrets:

- `CF_API_TOKEN_E2E`, Workers Scripts:Edit + Workers AI:Read, plus permissions for any product-specific targets you enable (R2 / D1 / KV / Queues / AI Gateway / Vectorize / Browser Rendering / Worker Loader / Hyperdrive / Email).
- `CF_ACCOUNT_ID_E2E`, Cloudflare account ID.
- `EMAIL_FROM`, `EMAIL_TO`, only needed if you enable `examples/email-workers`. Without them, the send call returns a structured error and the assertion still passes (it accepts either a real send or a structured `E_*` code).

The Braintrust recipes currently run explicitly with `bun rx:braintrust-*` rather than in this
matrix. Enrolling them requires a `BRAINTRUST_API_KEY` (injected into the ephemeral Worker via
`wrangler deploy --var`). No `ALCHEMY_PASSWORD` is needed — deploys use wrangler, not alchemy.

## FAQ

**Does it really deploy?** Yes. Each `run-e2e.sh` runs `flue build` then `wrangler deploy`, hits a real `*.workers.dev` URL, then `wrangler delete`s it. CI does the same. There is no mock layer.

**What does it cost?** ~$0.0001 per snippet per run (one Workers AI `@cf/moonshotai/kimi-k2.6` call). Free tier is plenty for the entire matrix.

**Do all snippets run on a stock token?** Most do. A few need extra access and will otherwise report a clear, non-fatal error: `hyperdrive` (token needs Hyperdrive), `braintrust-*` (need `BRAINTRUST_API_KEY`; `braintrust-ai-gateway` also needs a model provider configured in your Braintrust AI Gateway), `email-workers` (a verified sender, else it returns a structured `E_*` code and still passes).

**How does it deploy?** Flue 1.0 owns the deploy artifact: `flue build --target cloudflare` emits `dist/<name>/` with a generated `wrangler.json` (merged bindings + DO migrations), and `wrangler deploy --config dist/<name>/wrangler.json` ships it. Agents live in `src/agents/`, workflows in `src/workflows/`, verified provider ingress in `src/channels/`, and Cloudflare-native extras (extra DOs, Workflows, MCP servers) in `src/cloudflare.ts`.

**Why does CI run sequentially?** Workers AI rate-limits aggressively on personal accounts under parallel load. `max-parallel: 1` keeps the matrix green.

**Can I run only one?** Yes, every example, recipe, and template is independent. `bun ex:<name>`, `bun rx:<name>`, or `bun tpl:<name>`. Or trigger a single target from the Actions dropdown.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE).
