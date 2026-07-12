# TERRALOOP — Migrate flue-snippets to Flue 1.0

Migration plan to bring **every** example, recipe, and template up to date on the
latest Flue (`@flue/* 1.0.0-beta.9`, npm dist-tag `latest`).

Date: 2026-07-11
Status: **IN PROGRESS.** Migrated + live-verified so far: `kv`, `workers-ai`,
`r2`, `d1`, `queues`. Root repo stays pinned to `0.7.0`; each migrated example
carries its own local `1.0.0-beta.9` deps so the un-migrated snippets remain green.

### Progress log
- [x] `examples/kv` — workflow, KV binding, ephemeral namespace (id placeholder). E2E pass.
- [x] `examples/workers-ai` — workflow, model call via `cloudflare/@cf/...`,
      AI provider auto-registered from `ai` binding (no app.ts). E2E pass
      (`{"answer":"Done"}`). Confirms the model-call + AI-Gateway harness question.
- [x] `examples/r2` — workflow, R2 bucket (bind by `bucket_name`, ephemeral). E2E pass.
- [x] `examples/d1` — workflow, D1 db (`wrangler d1 create` → substitute UUID `database_id`). E2E pass.
- [x] `examples/queues` — workflow, Queue producer (`queues.producers`, bind by name). E2E pass.
- [x] `examples/worker-loader` — workflow, `worker_loaders` binding (no external resource). E2E pass.
- [x] `examples/vectorize` — workflow, `ai` + `vectorize` bindings; index created via
      `wrangler vectorize create --preset @cf/baai/bge-base-en-v1.5`. E2E pass. NOTE: assert on
      `dimensions===768` + `topMatch` KEY present (value may be null — Vectorize indexes
      asynchronously, a just-upserted vector isn't immediately queryable; matches original 0.7.0 semantics).
- [x] `examples/effect-hello` — workflow whose body is an Effect program; LLM call via
      `session.prompt` inside `Effect.gen` + `Effect.runPromise`. E2E pass
      (`{"greeting":"Hey Ada, great to see you!"}`). effect pinned `^4.0.0-beta.64` (matches root).
- [x] `examples/browser-rendering` — workflow, `browser` binding + `@cloudflare/puppeteer`.
      E2E pass (`title:"Example Domain"`, real Chromium). GOTCHA: don't clone a sibling
      `run-e2e.sh` via loose sed — the `EXAMPLE="$ROOT/examples/<x>"` path line must be set
      explicitly (a missed substitution deployed the wrong example → `workflow_not_found`).
- [x] `examples/email-workers` — workflow, `send_email` binding + `session.prompt` draft.
      E2E pass via structured `E_MISSING_EMAIL_FROM` (no EMAIL vars set — the key-free path);
      real-send path also handled. Either outcome asserts green.
- [x] `examples/hyperdrive` — workflow, `hyperdrive` binding + `postgres` driver. Builds
      clean on 1.0 (artifact emitted) and mirrors the proven pattern, but **live E2E is
      BLOCKED: the CLOUDFLARE_API_TOKEN lacks Hyperdrive permission** (`Authentication error
      10000` on `wrangler hyperdrive create`). Not a code issue — a token-scope limitation
      (consistent with the repo's per-product token model). Verify live once the token gains
      Hyperdrive:Edit, or in CI with a scoped token.
- [ ] durable-objects (design decision — see below)

### GOTCHA (learned on effect-hello): use `session.prompt`, NOT raw `env.AI.run`
A workflow that called `env.AI.run('@cf/...', { prompt })` directly got
`TypeError: Cannot read properties of undefined (reading 'trim')` — the raw AI
binding completion response via the auto AI Gateway is NOT `{ response }` shaped
the way 0.7.0 assumed. The idiomatic + portable path is
`(await harness.session()).prompt(text)` → `{ text }`. Only use the raw `env.AI.*`
binding for non-completion APIs like embeddings
(`env.AI.run('@cf/baai/bge-*', { text })` → `{ data }`, as in vectorize).

### Remaining examples — notes / design decisions needed
- **browser-rendering** — needs `browser` binding (`{ "browser": { "binding": "BROWSER" } }`) + `@cloudflare/puppeteer`. Workflow port; assert page title. Slower (allow long timeout).
- **email-workers** — needs `send_email` binding + verified sender; original tolerates structured `E_*` errors when EMAIL_FROM/TO unset. Workflow port, keep the either-outcome assertion.
- **hyperdrive** — needs a Hyperdrive config pointing at a Postgres origin; original tolerates connection failure (asserts shape/mention only). Workflow port with the lenient assertion; may need a placeholder connection string.
- **durable-objects** — DECIDED: **defer and build with the agent-shaped recipes**
  (`do-session`, `do-governor`, `chat-thinking`). Rationale: in 1.0 agents are
  fire-and-forget (`POST /agents/:name/:id` → `202 {streamUrl,offset,submissionId}`,
  no sync result; `?wait=result` → 400). The "same id = same DO" lesson is
  inherently agent-shaped and needs a NEW assertion harness distinct from the
  workflow `?wait=result` pattern: POST returns 202, then verify instance
  identity via `HEAD /agents/:name/:id` metadata and/or read conversation
  history at `GET /agents/:name/:id` from the returned stream coordinates. Rather
  than invent that harness once for durable-objects and again for the DO recipes,
  build the agent-instance E2E pattern ONCE when we reach the recipes, then apply
  it to durable-objects too. Canonical agent example reference:
  `examples/assistant` (uses `defineAgent` + `route`), workerd test pattern in
  `examples/github-channel/test-workerd/`.

### Example migration COMPLETE except: durable-objects (deferred, above) and
### hyperdrive (code done + builds; live E2E blocked on token Hyperdrive scope).
### 9 of 13 examples live-verified; 2 remaining are understood + planned.

### GOTCHA (learned on r2): substitute placeholders BEFORE any wrangler command
`wrangler <resource> create` reads the local `wrangler.jsonc` and rejects
`REPLACE_*` placeholders during config processing. Substitute the resource
name/id into `wrangler.jsonc` FIRST, then run `wrangler ... create`. For
resources whose id is known only post-create (D1 `database_id`), substitute the
NAME first, create, parse the id from output, then substitute the id.
- [x] recipes/github-triage — workflow, gateproof kept. E2E pass (severity=high reproducible=true).
- [x] recipes/do-session — AGENT instance, durable session memory. E2E pass
      (turn 2 recalled "octarine"). Established the reusable agent-instance harness.
- [x] recipes/do-governor — WORKFLOW (deterministic govern() + model turns). E2E pass
      (escalated continue→reanchor→ask-human over 5 repeats).
- [x] examples/durable-objects — AGENT, DO routing. E2E pass with a STRONGER test than
      0.7.0: same id recalls (octarine), different id is isolated (no leak).
- [x] examples/ai-gateway — WORKFLOW; named AI Gateway via `registerProvider` in
      `src/app.ts` + `session.prompt`. E2E pass (`{"answer":"Hi","gateway":"jordan"}`).
      GOTCHA: a NAMED gateway must already exist (default auto-creates, named does not);
      account has `jordan` + `default`. Uses `jordan` (the repo's original default).
- [~] recipes/chat-thinking — MIGRATED to 1.0 shape (workflow + `src/cloudflare.ts`
      co-hosting the `Thinker` Think DO + `durable_objects` binding/migration) and
      BUILDS clean, but **live E2E BLOCKED**: `@cloudflare/think@0.12.1` errors at
      runtime. Cleared two Think-version hurdles (needs `agents@^0.17.1` not 0.14 —
      `AutoContinuationController` missing export; `chat()` callback now requires all of
      `onStart/onEvent/onDone/onError`), but `chat()` then throws an opaque Think-internal
      error. Disproportionate to debug the third-party Think DO now; revisit with a Think
      version bump or upstream guidance.
- All 13 examples migrated (hyperdrive live-blocked on token scope; rest live-verified).
- [x] recipes/virtual-sandbox — WORKFLOW; R2 docs seeded into the virtual sandbox via
      harness.fs, agent greps them. E2E pass (answered "Octarine"). GOTCHA: `harness.fs`
      writes from the sandbox ROOT, so write under `/workspace/...` to match the agent's
      `cwd:/workspace` (0.7's `getVirtualSandbox(R2)` FS-mount is GONE in 1.0).
- [x] recipes/lab-receipt — WORKFLOW + `@acoyfellow/lab`; session.prompt then createReceipt.
      E2E pass (emitted + served a real https://lab.coey.dev/results/... receipt). LAB_URL
      is a runtime var substituted from .env via a REPLACE_LAB_URL placeholder.
- [~] recipes/mcp-client — DEFERRED. Two-Worker recipe: a Flue agent + a co-hosted
      `McpAgent` MCP server. In 1.0 the MCP server co-hosts via `src/cloudflare.ts`
      exports + a DO binding, and the workflow connects via `connectMcpServer(url)`. The
      hard part is the self-referential URL (a single Worker connecting to its own `/mcp`)
      and MCP-server route mounting — no upstream example co-hosts one. Needs dedicated
      MCP-in-1.0 design; revisit after the channel work.
- [x] recipes/gateway-lab — WORKFLOW; AI Gateway (app.ts registerProvider) + Lab receipt.
      E2E pass (gateway=jordan, real receipt).
- [x] recipes/lab-checkpoint — WORKFLOW; interval-checkpoint receipts (caller threads cycle).
      E2E pass (first-cycle checkpoints + mid-cycle skips). NOTE: bumped mid-gate gateproof
      timeout to 200s/230s — the model call flaked at the default 120s.
- [x] recipes/braintrust-trace — WORKFLOW; session.prompt wrapped in a Braintrust
      trace span (initLogger + traced + flush). E2E pass (trace flushed to project).
      BRAINTRUST_API_KEY injected via `wrangler deploy --var BRAINTRUST_API_KEY:$KEY`.
- [x] recipes/braintrust-otel — WORKFLOW; OTel span → BraintrustSpanProcessor. E2E pass.
      FIX: bound the flush with `Promise.race([forceFlush, timeout(8s)])` and dropped
      `provider.shutdown()` — the raw forceFlush+shutdown HUNG in workerd.
- [x] recipes/braintrust-eval — WORKFLOW (system under test) + `bunx braintrust eval`.
      E2E pass (experiment uploaded, contains_requested_word 100%). FIX: the eval CLI
      dropped `--no-input --json`; use `--no-progress-bars`.
- [~] recipes/braintrust-ai-gateway — MIGRATED (workflow, fetch to hosted BT gateway) and
      builds/deploys, but **live E2E env-BLOCKED**: the Braintrust org 'Cloudflare' has NO
      model provider keys configured in its AI Gateway (`no provider configured for
      'gpt-4o-mini'`), and this API key can't add them. Code is correct; needs a provider
      key in Braintrust Settings → AI Providers. Same category as hyperdrive (env, not code).
- Braintrust key: found in env (`BRAINTRUST_API_KEY`, 51 chars, valid — 64 projects). No
  ALCHEMY_PASSWORD needed (wrangler deploy, not alchemy).
- [x] recipes/dynamic-workflow — WORKFLOW front door + co-hosted TaskQueue DO +
      TaskRunnerWorkflow (Cloudflare Workflow) in `src/cloudflare.ts` (`durable_objects` +
      `workflows` bindings/migrations). E2E pass (3 tasks drained in order, instance
      complete). GOTCHA: first enqueue races the Workflow binding cold start → probe
      `call()` retries transient 500s. The hardest recipe; proves DO+Workflow co-hosting.
- [ ] templates/github-app (channel), recipes/event-trigger (channels)
- [x] templates/github-app — CHANNEL (`@flue/github@1.0.0-beta.1`); real x-hub-signature-256
      HMAC over raw body → dispatch to triage agent. E2E pass (unsigned 401, wrong-sig 401,
      signed issues.opened 200 → dispatched). GOTCHA: beta.9 `dispatch(agent, { id, input })`
      wants `input` (JSON payload), NOT `{ message }` (docs are ahead of published beta.9).
- [x] recipes/event-trigger — WORKFLOW; one signed-webhook front door (generic HMAC +
      lib/normalize) → routing skill. E2E pass all 6 gates (unsigned/wrong-sig 401;
      Sentry→page, PagerDuty→page, GitLab CI→notify, cron→log). The thread's core ask.
      NOTE: batched gateproof can flake on cold start (model calls); reruns green.
- [ ] repo-wide docs (README/site/CI) + collapse to single root 1.0 pin

## STATUS: MIGRATION COMPLETE — all 30 snippets on Flue 1.0 (`@flue/* 1.0.0-beta.9`).

**13 examples + 16 recipes + 1 template migrated.** 27 live-verified end-to-end
(deploy to real *.workers.dev → assert → teardown, zero leftover workers). 3
code-complete + build-clean but live-blocked by external/account limits:

- **hyperdrive** — live-blocked: CLOUDFLARE_API_TOKEN lacks Hyperdrive:Edit scope.
- **braintrust-ai-gateway** — live-blocked: the Braintrust org 'Cloudflare' has no
  model provider keys in its AI Gateway (can't add via this API key).
- **chat-thinking** — live-blocked: `@cloudflare/think@0.12.1` throws an opaque
  internal error at runtime (its WorkerLoader-based extension system). Cleared
  agents@0.17, the 4-method chat() callback, and the LOADER binding; the DO still
  errors internally. Needs a Think version bump / upstream guidance.

mcp-client (initially deferred) is DONE and live-verified: the co-hosted MCP
server is exported from `src/cloudflare.ts`, mounted at `/mcp` in `src/app.ts`
with `ReverseServer.serve('/mcp', { binding: 'ReverseServer' })`, and the
workflow connects to the Worker's own /mcp via `connectMcpServer` INSIDE the
async `defineAgent` initializer (module-scope I/O is forbidden on Workers).

### Harness cleanup done
- Deleted all `alchemy.run.ts` (snippets) + shared `scripts/alchemy.run.ts` +
  `scripts/run-example.sh` (each example now has its own `run-e2e.sh`).
- `package.json` `ex:*` scripts now point at each example's `run-e2e.sh`; removed
  the generic `ex` runner. `rx:*`/`tpl:*` unchanged.
- `.gitignore` covers `.flue-vite/` + `.flue-vite.wrangler.jsonc`.
- Each snippet is self-contained: own `package.json` + local `node_modules` at
  `1.0.0-beta.9` (+ `agents@^0.17.1` where `@cloudflare/think`/MCP need it). Root
  `@flue`/`alchemy` deps left as-is (only `site/` still uses alchemy).
- biome clean across examples/recipes/templates.

### Remaining (not code migration)
- [ ] Repo-wide docs: README (drop "why no wrangler / alchemy owns the graph"
      → "Flue-generated wrangler config + `wrangler deploy`"), site copy, CI
      (`.github/workflows/e2e.yml`: alchemy → `flue build` + `wrangler deploy`).
- [ ] Optional: collapse to a single root 1.0 pin once the per-snippet isolation
      is no longer needed.
- [ ] Nothing pushed/committed — awaiting review.

### NOTE: `agents` peer version
`@flue/*@1.0.0-beta.9` works with `agents@0.14.x` (deploy-guide default) AND `agents@0.17.x`.
Recipes pulling `@cloudflare/think` need `agents@^0.17.1`. Safe to standardize on
`agents@^0.17.1` repo-wide at the final collapse step.

### AGENT-INSTANCE HARNESS (validated on do-session) — reuse for all agent recipes
- Agent source: `src/agents/<name>.ts`, `defineAgent(() => ({ model, instructions }))` + `export const route`. Migration `new_sqlite_classes: [Flue<Name>Agent]`.
- **HTTP body shape**: `POST /agents/<name>/<id>` takes `{ "message": string }` (NOT the `{kind:'user',body}` DeliveredMessage — that's for `dispatch()`). Wrong shape → `400 invalid_request`.
- **Fire-and-forget**: POST returns **202** (not 200); no sync result; `?wait=result` → 400.
- **Read the reply**: poll `GET /agents/<name>/<id>?view=history` → `{ messages: [{ role, parts:[{type:'text',text}] }] }`; filter `role==='assistant'`, concat text parts, wait until assistant-message count grows past the prior count. See `recipes/do-session/probe.ts`.
- **Warmup**: POST a throwaway turn until 202/200.

### Validated repeatable pattern (per example)
1. `src/workflows/<name>.ts`: `defineWorkflow({ agent: defineAgent(...), input, output, run })` + `export const route`. Bindings via `import { env } from 'cloudflare:workers'`. Model id `cloudflare/@cf/...` only when needed.
2. `wrangler.jsonc`: `name flue-snippet-<x>`, `nodejs_compat`, `migrations` (`new_sqlite_classes` for `FlueRegistry` + `Flue<Name>Workflow`), plus the product binding (`kv_namespaces`/`ai`/`r2_buckets`/...); resource ids that must be created at test time use a `REPLACE_*` placeholder.
3. `package.json` (local 1.0 deps) + `bun install` (isolated node_modules).
4. `run-e2e.sh`: [create resource if needed] → `flue build --target cloudflare` → deploy `dist/<name>/wrangler.json` (dry-run first) → retry-loop assert on `POST /workflows/<name>?wait=result` → teardown worker (+resource) → zero-leftover check. Backup/restore `wrangler.jsonc` around id substitution.
5. Delete the old 0.7.0 `<name>.ts`; update README; clean `.flue-vite`/`dist` (gitignored).

## Step 1 spike result — examples/kv (DONE 2026-07-11)

Migrated `examples/kv` from a 0.7.0 webhook agent to a Flue 1.0 **workflow** and
proved it end-to-end against a real deploy. Full E2E passed:
`round-trip assertion passed {"key":"e2e-kv","read":"round-trip","match":true}`
followed by `zero leftover workers after teardown`. Account verified clean (no
leftover kv worker or KV namespace).

**Files (examples/kv/):**
- `src/workflows/kv.ts` — `defineWorkflow` + minimal `defineAgent` + `export const route`.
  Reaches the binding via `import { env } from 'cloudflare:workers'` then
  `(env as unknown as { KV: KVNamespace }).KV`. No model call (pure KV round-trip).
- `wrangler.jsonc` — source config: `name: flue-snippet-kv`, `nodejs_compat`,
  `migrations` with `new_sqlite_classes: [FlueRegistry]` and `[FlueKvWorkflow]`,
  `kv_namespaces` binding `KV` with id placeholder `REPLACE_KV_NAMESPACE_ID`.
- `run-e2e.sh` — self-contained: creates an ephemeral KV namespace, substitutes
  the id into a working copy of `wrangler.jsonc` (restored from backup on exit),
  `flue build --target cloudflare`, `wrangler deploy --dry-run` then real deploy
  of `dist/<name>/wrangler.json`, retrying warmup + assert loops on
  `POST /workflows/kv?wait=result`, then tears down worker + KV namespace and
  asserts zero leftover workers.
- `package.json` — local 1.0 deps (`@flue/runtime`/`@flue/cli` `1.0.0-beta.9`,
  `agents@^0.14.2`, `wrangler`, `valibot`); `bun.lock` committed alongside.
- `README.md` — updated tagline + new `POST /workflows/kv?wait=result` contract.
- Deleted the old `kv.ts` (0.7.0 agent).
- Root `.gitignore` — added `.flue-vite/` + `.flue-vite.wrangler.jsonc` (1.0 build artifacts).

**Commands that work (from examples/kv/):**
```sh
bun install                 # local 1.0 deps, isolated from root 0.7.0
bash run-e2e.sh             # create-KV → build → deploy → assert → teardown
```

**Open questions RESOLVED by the spike:**
- *Binding access inside a workflow `run` on Cloudflare:* use
  `import { env } from 'cloudflare:workers'` and read the binding off `env`
  (`env.KV`). No `harness`/`ctx` plumbing needed for plain bindings.
- *KV namespace provisioning for E2E:* create ephemerally in `run-e2e.sh` via
  `wrangler kv namespace create <name-$(date +%s)>`, parse the id, substitute
  the `REPLACE_KV_NAMESPACE_ID` placeholder into a working `wrangler.jsonc`
  (backup/restore on exit), delete the namespace in teardown.
- *HTTP invocation shape:* synchronous invocation is
  `POST /workflows/<name>?wait=result` → `{ result, runId }` (HTTP 200). A bare
  `POST /workflows/<name>` (no `?wait=result`) does NOT return the result here
  (404/202-ish) — always use `?wait=result` for the assert.
- *Cold start:* the first `?wait=result` after deploy can 404 (route not warm)
  then 500 (DO/registry cold) before settling to 200. Both warmup and assert
  must retry on non-200; the assert also greps for `"match":true`. Steady-state
  is stable 200.
- *Isolation from root 0.7.0:* installing 1.0 deps inside `examples/kv/` and
  invoking `npx flue`/`npx wrangler` from that dir resolves the local binaries,
  leaving the root `node_modules` (0.7.0) and the other snippets untouched.

**Deviations from the original plan:**
- Worker name is `flue-snippet-kv` (not `flue-ex-kv`); fine, just note the naming.
- Warmup is NOT a separate `/api/ping` health route (the plan floated adding
  one via `app.ts`); the retry-until-200 loop on the real workflow route is
  simpler and sufficient. Revisit if a keyed/model workflow needs cheaper warmup.
- Per-example local `node_modules` (vs a single root bump) is the deliberate
  isolation strategy while the repo is mid-migration. Once ALL snippets are on
  1.0, collapse back to a single root `@flue/* ^1.0` pin and drop per-example
  installs.

---


> Prior journey: the Flue "returned `Response` swallowed to `{}`" investigation
> that surfaced this migration is preserved in
> [`TERRALOOP-flue-response-bug.md`](./TERRALOOP-flue-response-bug.md). TL;DR of
> that doc: the bug is already fixed upstream, there is **no clean intermediate
> version bump** (`@flue/sdk/client` is dropped in 0.11.0; the webhook-agent
> serialization guard only lands with the 0.8→1.0 rearchitecture; 0.7.1 is also
> broken by `pi-ai` wildcard drift). The only forward path is this full migration
> to 1.0.

---

## Why this is a migration, not a bump

Flue 1.0 is a ground-up redesign of everything this repo depends on. Confirmed by
reading the 1.0 docs and working examples in the upstream repo
(`github.com/withastro/flue`, `apps/docs/`, `examples/`):

| Concern | 0.7.0 (current repo) | 1.0.0-beta.9 (target) |
|---|---|---|
| Source layout | `agents/<name>.ts` at recipe root | `src/` (or `.flue/`) with `agents/`, `workflows/`, `channels/`, optional `app.ts`, `cloudflare.ts`, `flue.config.ts` |
| Unit of work | one shape: `export default async ({payload,env}) => {}` + `export const triggers = { webhook: true }` | **agents** (addressable, continuing, `POST /agents/:name/:id`) vs **workflows** (finite input→result, `POST /workflows/:name`) vs **channels** (verified provider ingress, `POST /channels/:name/:suffix`) |
| Agent def | bare default-export function | `defineAgent(() => ({ model, instructions, tools, skills, sandbox }))` + `export const route` |
| Workflow def | (n/a) | `defineWorkflow({ agent, input, output, run })` + `export const route`/`runs` |
| Handler API | `init()` → `agent.session()` → `session.skill()/prompt()` | `run({ harness, input })` → `harness.session()` → `session.prompt(text, { result: schema })` → `response.data` |
| SDK import | `@flue/sdk/client` (`FlueContext`) | `@flue/runtime` (`defineAgent`, `defineWorkflow`, `AgentRouteHandler`, `WorkflowRouteHandler`, `invoke`, `dispatch`) |
| Result contract | JSON object serialized (silent `{}` on non-JSON in 0.7.0) | JSON via valibot `output`/`result`; non-serializable → explicit `action_output_serialization` 500 |
| Model provider | `cloudflare-workers-ai/@cf/...`, creds via `CLOUDFLARE_*` vars | `anthropic/...`, `cloudflare/...`; Cloudflare AI Gateway auto-registered via `AI` binding |
| DO classes | Flue-named per agent (`GithubTriage`), alchemy-declared | `Flue<Name>Agent`/`Flue<Name>Workflow` + `FlueRegistry`, explicit `wrangler.jsonc` `migrations` (`new_sqlite_classes`) owned by the project |
| Build output | `.build/_entry.ts` (module for a bundler) | `dist/<name>/index.js` + Flue-owned `dist/<name>/wrangler.json` (`no_bundle: true`) |
| Deploy | **alchemy** (`alchemy deploy`/`destroy`, resource graph in TS) | **wrangler** (`wrangler deploy --config dist/<name>/wrangler.json`); bindings declared in source `wrangler.jsonc` |
| Signature verification | hand-rolled `lib/verify-signature.ts` per recipe | first-party **channel packages** (`@flue/github`, `@flue/slack`, …) own HMAC + parsing + handshakes; generic channel blueprint for the rest |
| `agents` peer | (transitive) | explicit `agents@^0.14.2` (runtime checks for `runFiber`) |

Two repo-narrative consequences:

- The README's headline **"Why no wrangler? alchemy owns the resource graph"**
  is reversed in 1.0 — Flue now generates the wrangler config and expects
  `wrangler deploy`. The whole "no wrangler / alchemy" story must be rewritten.
- The webhook-agent recipes (`event-trigger`, `github-app`, `github-triage`)
  map cleanly onto **channels + workflows**, which is strictly better (real
  signature verification, typed provider payloads, real HTTP status via `route`
  middleware — no more in-body `{ ok:false, status }` workaround).

---

## Target architecture per snippet kind

### Examples (one CF product each)

Most examples (`kv`, `r2`, `d1`, `queues`, `vectorize`, `hyperdrive`,
`durable-objects`, `worker-loader`, `browser-rendering`, `email-workers`) are
"touch one binding and return a result" — these are **workflows** in 1.0:

```ts
// src/workflows/kv.ts
import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';

export const route: import('@flue/runtime').WorkflowRouteHandler = async (_c, next) => next();

export default defineWorkflow({
  agent: defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' })),
  input: v.object({ key: v.string(), value: v.string() }),
  output: v.object({ key: v.string(), read: v.string(), match: v.boolean() }),
  async run({ input }) {
    // binding access: see cloudflare.ts / env note below
    ...
  },
});
```

- `ai-gateway`, `workers-ai`, `effect-hello` are model calls → workflow with a
  `prompt(..., { result })` inside `run`.
- Bindings (`KV`, `R2`, `DB`, `QUEUE`, `LOADER`, `BROWSER`, `HYPERDRIVE`, `AI`)
  are declared in each example's source `wrangler.jsonc` and reached via
  `env`/`cloudflare:workers` inside the workflow (confirm the exact accessor
  against `examples/cloudflare/src/workflows/*` and `with-cloudflare-binding.ts`).

### Recipes

- `github-triage` → **workflow** with inline `prompt(..., { result: triageSchema })`.
  (Already migrated in spirit on 0.7.0 — the inline-rubric `prompt()` port carries
  over; only the wrapper shape changes.)
- `event-trigger` → **channels + a workflow**. Replace `lib/verify-signature.ts`
  and `lib/normalize.ts`'s ingress half with real channels:
  - GitHub → `@flue/github` (`createGitHubChannel`).
  - Google Chat → `@flue/google-chat`.
  - Sentry / PagerDuty / GitLab CI → **generic channel blueprint**
    (`flue add channel <provider-webhook-docs-url>`), since no first-party
    package exists. Keep `normalize.ts` as the canonical-event mapper the channel
    handlers feed into, then `invoke()` the routing workflow.
  - The routing decision stays a workflow (`prompt(..., { result: routeSchema })`).
  - Auth failures become real HTTP responses in channel middleware — drop the
    `{ ok:false, status:401 }` in-body workaround.
- `dynamic-workflow` → revisit: 1.0 has native workflows + `invoke()`/`dispatch()`;
  the DO-queue + Cloudflare Workflow runner may simplify substantially or move to
  `cloudflare.ts` exports.
- `do-session`, `do-governor`, `chat-thinking`, `mcp-client`, `virtual-sandbox`,
  `lab-*`, `gateway-lab`, `braintrust-*` → re-express as agents (continuing) or
  workflows (finite) per their nature; braintrust/otel/lab observability hooks
  move to `app.ts`/`cloudflare.ts` runtime registration.

### Template

- `github-app` → the canonical **`@flue/github` channel** example (issues.opened
  → triage workflow, pull_request.opened → pr-review workflow). This becomes much
  smaller: no hand-rolled HMAC, no `_headers` shim, real `route` middleware,
  outbound via the Octokit `client` export.

---

## Deploy & E2E harness changes

- **Delete `scripts/alchemy.run.ts` and all `recipes/*/alchemy.run.ts`.** Deploy
  becomes: `flue build --target cloudflare` → `wrangler deploy --config
  dist/<name>/wrangler.json`. Teardown: `wrangler delete --name <name>`.
- **`scripts/run-example.sh` + every `run-e2e.sh`** rewrite:
  1. `flue build --target cloudflare`
  2. `wrangler deploy --dry-run --config dist/<name>/wrangler.json` (fast sanity)
  3. `wrangler deploy --config dist/<name>/wrangler.json`
  4. warmup: POST the workflow/channel route (still no `/health` unless we add one
     via `app.ts` — 1.0's `app.ts` supports custom routes like `/api/ping`; we can
     standardize a real health route project-side).
  5. gateproof / assert against the deployed URL.
  6. `wrangler delete --name <name>`.
- Each snippet needs a **source `wrangler.jsonc`** with `name`,
  `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, `migrations`
  (with `new_sqlite_classes` for `FlueRegistry` + each generated class), and its
  product binding (`kv_namespaces`, `r2_buckets`, `ai`, `worker_loaders`, etc.).
- **Provider bindings that need resources** (KV namespace, R2 bucket, D1, Queue,
  Vectorize index) currently created by alchemy must be created another way:
  either `wrangler` resource commands in `run-e2e.sh` (e.g.
  `wrangler kv namespace create`), or `wrangler.jsonc` with pre-provisioned
  names. Decide per product; document in each README.
- **Secrets/vars**: `.dev.vars` for local, `wrangler secret put` / `[vars]` for
  deploy. Provider API keys (`anthropic/...`) or keep `cloudflare/...` models so
  the E2E stays free and key-light via the auto AI Gateway.

## Testing additions

- 1.0 examples ship `test-workerd/` vitest suites via
  `@cloudflare/vitest-pool-workers` (see `examples/github-channel`). Adopt this
  for channel signature tests (valid/invalid/handshake) instead of only live E2E.
- Keep gateproof for the live deployed assertions.

---

## Dependency changes (package.json)

```jsonc
{
  "devDependencies": {
    "@flue/cli": "^1.0.0-beta.9",
    "wrangler": "^4.97.0",
    "@cloudflare/workers-types": "^4.x",
    "@cloudflare/vitest-pool-workers": "^0.x",   // channel tests
    "vitest": "^4.x"
  },
  "dependencies": {
    "@flue/runtime": "^1.0.0-beta.9",
    "agents": "^0.14.2",                          // explicit; runtime needs runFiber
    "@flue/github": "^1.0.0-beta.9",              // event-trigger + github-app
    "@flue/google-chat": "^1.0.0-beta.9",         // event-trigger (Gchat)
    "valibot": "^1.x"
    // drop: alchemy, @flue/sdk (client subpath gone), workers-ai-provider (?)
  }
}
```

- **Remove `alchemy`** entirely (deploy is wrangler now).
- **`@flue/sdk`** is likely no longer needed (agents import from `@flue/runtime`).
  Confirm nothing else uses it.
- **Pin `@earendil-works/pi-ai`** if wildcard drift recurs (it broke 0.7.1). 1.0
  may vendor this differently — verify after install.

---

## Execution plan (incremental, verify-as-you-go)

Do NOT big-bang. Migrate one snippet end-to-end, prove the new harness, then
fan out. Suggested order (simplest binding → most complex):

1. **Spike: `examples/kv`** — full migration (source `wrangler.jsonc`, workflow,
   rewritten `run-e2e.sh`, wrangler deploy + destroy, live assert). This validates
   the entire new harness and resource-creation approach. Land it, keep it green.
2. **`examples/workers-ai`** — validates model calls + AI Gateway auto-registration.
3. Remaining single-binding examples (`r2`, `d1`, `queues`, `vectorize`,
   `hyperdrive`, `durable-objects`, `worker-loader`, `browser-rendering`,
   `email-workers`, `effect-hello`) using the proven pattern.
4. **`recipes/github-triage`** — first workflow recipe with gateproof.
5. **`templates/github-app`** — first channel (`@flue/github`); becomes the
   reference channel snippet.
6. **`recipes/event-trigger`** — channels (github + google-chat + generic
   Sentry/PagerDuty/GitLab) → normalize → routing workflow. The thread's actual
   ask, now expressed idiomatically.
7. Remaining recipes (`do-*`, `chat-thinking`, `mcp-client`, `virtual-sandbox`,
   `dynamic-workflow`, `lab-*`, `gateway-lab`, `braintrust-*`).
8. **Repo-wide docs**: rewrite `README.md` (drop "no wrangler / alchemy owns the
   graph" narrative → "Flue-generated wrangler config, `wrangler deploy`"),
   `CONTRIBUTING.md`, the site (`site/`) copy, and the `scripts/update.ts`
   maintenance flow.
9. **CI** (`.github/workflows/e2e.yml`): swap alchemy steps for
   `flue build` + `wrangler deploy`; add channel `test-workerd` job; keep
   `max-parallel: 1` for Workers AI rate limits.

Gate each step on a live E2E (deploy → assert → destroy) and zero leftover
workers (`GET /accounts/:id/workers/scripts` check).

---

## Open questions to resolve during the spike

- **Binding access inside a workflow `run`**: exact accessor for `env.KV` etc.
  on the Cloudflare target (check `examples/cloudflare/src/workflows/*` and
  `agents/with-cloudflare-binding.ts`). Does it come through `harness`, a
  `cloudflare:workers` `env` import, or `cloudflare.ts` exports?
- **Resource provisioning in E2E**: create KV/R2/D1/Queue/Vectorize via
  `wrangler ... create` in `run-e2e.sh`, or pre-provision and reference by name?
  Ephemeral naming + cleanup story per product.
- **Health/warmup route**: standardize a project-side `app.ts` `/api/ping` (like
  `examples/cloudflare`) so warmup is a real 200 without hitting the model.
- **Free-tier model**: keep `cloudflare/@cf/...` (AI Gateway auto-registered) to
  stay key-light, or move to a keyed provider? Affects CI secrets.
- **`gateproof`/`@acoyfellow/lab`/braintrust** compatibility with the 1.0
  runtime event shapes.
- **Worker Loader + dynamic-workflow**: does 1.0's native workflow model replace
  the custom DO-queue runner, or does it still live in `cloudflare.ts`?

---

## Upstream reference anchors (all in `github.com/withastro/flue`)

- Deploy guide: `apps/docs/src/content/docs/ecosystem/deploy/cloudflare.md`
- Project layout: `apps/docs/src/content/docs/guide/project-layout.md`
- Agents / Workflows / Channels: `apps/docs/src/content/docs/guide/{building-agents,workflows,channels}.md`
- Working example (CF bindings + workflows + `app.ts` + `wrangler.jsonc`): `examples/cloudflare/`
- Working channel example (HMAC, dispatch, outbound SDK, workerd tests): `examples/github-channel/`, `examples/google-chat-channel/`
- Agent/Workflow API: `apps/docs/src/content/docs/api/{agent-api,workflow-api}.md`
- Generic channel blueprint (Sentry/PagerDuty/GitLab): `blueprints/channel.md`
