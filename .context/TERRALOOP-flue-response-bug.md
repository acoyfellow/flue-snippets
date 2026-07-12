# TERRALOOP — Flue "returned Response swallowed to `{}`" investigation

Journey log for chasing the Flue webhook-agent result-serialization bug from a
flue-snippets symptom back to the upstream source, and deciding what (if
anything) to ship.

Date: 2026-07-11
Author: agent session (jcoeyman)
Status: **CLOSED — no upstream change needed. Bug already fixed on Flue `main`.**

---

## TL;DR

- Symptom (in flue-snippets on `@flue/runtime@0.7.0`): a webhook agent that
  `return new Response(..., { status: 401 })` was silently serialized to
  `{"result":{}}` with **HTTP 200**. Auth gating via HTTP status was impossible.
- Root cause in 0.7.0: the webhook agent path invoked the handler directly
  (`handler(ctx)` via `defaultRunHandler`/`keepAliveWhile`) and JSON-stringified
  whatever it returned, with **no JSON-serializability guard**. A `Response`
  object stringifies to `{}`.
- Upstream is `github.com/withastro/flue` (Apache-2.0 monorepo, lead maintainer
  `fredkschott`). Cloned, installed, built, ran the 783-test suite.
- **Verified on `main` (`1.0.0-beta.9`): the bug does NOT reproduce.** Returning
  a `Response` now yields **HTTP 500 `action_output_serialization`** — an
  explicit, correct error — because the result path was rearchitected to run
  through `runActionWithParsedInput` → `cloneJsonSerializable`, which rejects any
  non-plain-JSON value.
- Therefore: **no PR.** (Also, Flue's `CONTRIBUTING.md` does not accept PRs at
  all — they auto-close and convert to issues/discussions.) The correct fix for
  flue-snippets is to **upgrade off the `^0.7.0` pin**.

---

## Why "returning a Response" was never the right pattern anyway

Flue agent/workflow results are **event-sourced**: the return value is persisted
into the `run_end` event, the run store, and the durable event stream, and is
replayable/streamable. That contract requires JSON-serializable output. A
`Response` object is not serializable and cannot be persisted or replayed.

So the flue-snippets convention we adopted — return a plain object such as
`{ ok: false, status: 401 }` and let the probe assert on the body — is the
**correct** usage, not a workaround. The only real defect was 0.7.0 doing this
*silently* (data loss) instead of erroring.

---

## Timeline / steps

1. **Locate upstream.** Packages ship no `repository` metadata; the npm registry
   record for `@flue/runtime` points to `github.com/withastro/flue`
   (`packages/runtime`), homepage `flueframework.com`, maintainer `fredkschott`.

2. **Study landed-PR conventions** (for the hypothetical PR):
   - Branch names: `fix/<kebab-slug>` (e.g. `fix/packaged-skill-resource-reader`,
     `fix/compact-stream-chunk-persistence`).
   - PR body: `## Summary` (bullets) + `## Validation` (commands run).
   - Change shape: source edit + **colocated test** in `packages/runtime/test/`.
     No changeset files; tests are first-class. Tooling is **pnpm + biome +
     vitest** (`pnpm run build`, `pnpm test`, `pnpm run check`).
   - **CONTRIBUTING.md: PRs are NOT accepted.** Only bug reports (issues,
     `.github/ISSUE_TEMPLATE/01-bug-report.md`) and feature requests
     (discussions). "Surgical Team" model — the maintainer drives implementation.

3. **Reproduce locally.**
   - `git clone --depth 30 https://github.com/withastro/flue`
   - `corepack pnpm install --frozen-lockfile` (Node 24, pnpm 11.1.1)
   - `pnpm --filter @flue/runtime run build` → OK
   - `pnpm --filter @flue/runtime test` → **783 passed, 1 skipped** (baseline).
   - Wrote a throwaway repro test (`test/zzz-repro.test.ts`) modeled on the
     existing `?wait=result` sync-mode tests in `test/workflow-runs.test.ts`,
     with a workflow whose `run` returns `new Response('nope', { status: 401 })`.
   - Result on `main`: **HTTP 500**, body
     `{"error":{"type":"action_output_serialization","message":"Action \"workflow\" output is not JSON-serializable.", ...}}`.
   - Removed the throwaway test. Working tree left clean.

4. **Locate the source + confirm the guard path.**
   - Flagged site: `packages/runtime/src/runtime/handle-agent.ts`,
     `runSyncMode` (~L523) — always `new Response(JSON.stringify({ result, runId }))`.
   - But every result reaching `runSyncMode` first flows through
     `startWorkflowExecution` → `executeWorkflowDefinition` (L565) →
     `runActionWithParsedInput` (`src/action.ts:126`) →
     `cloneJsonSerializable` (`src/json-snapshot.ts`), which `assertJsonLike`
     rejects any object whose prototype isn't `Object.prototype`/`null`
     (a `Response` fails this) and throws `ActionOutputSerializationError`.
   - No bypass exists on `main`: `runSyncMode` only ever sees guarded, already
     JSON-serializable results.

5. **Pin the version boundary.**
   - `@flue/runtime@0.7.0`: webhook path is `handler(ctx)` direct; **no
     `action_output_serialization` guard string present** → silent `{}`. (This
     is what flue-snippets `bun.lock` resolved.)
   - `@flue/runtime@0.7.1`: guard string present, but webhook path is **still
     `handler(ctx)` direct** — likely still gapped for that path.
   - `@flue/runtime@0.8.0` … `1.0.0-beta.9`: rearchitected to route through the
     action/workflow guard. `dist-tags.latest = 1.0.0-beta.9`.
   - Verified live only on `main`/beta.9 (see step 3). The 0.7.x line is legacy.

---

## Decision

**No upstream contribution.** The bug is fixed on `main`, and Flue does not
accept PRs. If it still mattered, the vehicle would be an issue using the agent
bug-report template — but there is nothing to report against current `main`.

### Follow-up for flue-snippets (separate from this journey)

- The in-repo agents already return plain JSON objects (`{ ok:false, status:401 }`),
  which is the correct, forward-compatible pattern. Keep that; it works on the
  pinned runtime and the probes assert on the body, not HTTP status. The
  silent-`{}` behavior therefore never affects current repo code — it only
  surfaced during debugging when a `Response` was returned.
- **Version-bump attempt (2026-07-11): abandoned. There is no clean bump.**
  Tried moving `@flue/* ^0.7.0` → `^1.0.0-beta.9` (`latest`). Findings:
  - **1.0.0-beta.9 is a major redesign** the whole repo predates: build emits a
    self-contained bundled Worker (`dist/<name>/index.js` + Flue-owned
    `wrangler.json`, `no_bundle:true`) deployed via `wrangler deploy --config`,
    **not** an `_entry.ts` fed to alchemy. Agent shape moved to `.flue/workflows/*`
    with `defineWorkflow` + `route` export + `harness.session().prompt(...,{result})`.
    DO classes renamed `Flue*` with explicit `wrangler.jsonc` `migrations`. This
    contradicts the repo's core "why no wrangler / alchemy owns the graph"
    premise and would be a multi-day rewrite of all 13 examples + 15 recipes +
    1 template + the shared example runner + README/FAQ.
  - **No intermediate version is both compatible and fixed:**
    - `@flue/sdk/client` (imported by every agent) exists through **0.10.2**,
      **dropped in 0.11.0**.
    - `_entry.ts` build shape holds through **0.11.1**; the bundled/wrangler
      redesign is **1.0-only**.
    - The webhook-agent `runSyncMode` path is **byte-identical in 0.7.0 and
      0.7.1** (`handler(ctx)` direct, no serialization guard) — so 0.7.1 does
      NOT fix the silent-`{}` for agents. The `action_output_serialization`
      guard only covers the action/workflow path until the 0.8–1.0 agent
      rearchitecture. So every version that actually fixes the webhook path
      also carries the breaking migration.
  - **0.7.1 is additionally broken by dependency drift:** `@flue/runtime` pins
    `@earendil-works/pi-ai: *` (wildcard). Re-resolving pulled `pi-ai@0.80.6`,
    which removed the `getModel` export 0.7.1 imports →
    `SyntaxError: ... does not provide an export named 'getModel'`. The committed
    `bun.lock` pins the working `pi-ai@0.74.1`.
  - **Action taken:** fully restored `package.json` + `bun.lock` to HEAD
    (`@flue/* 0.7.0` + `pi-ai 0.74.1`, the validated combo), re-added the
    `rx:event-trigger` script line, and re-verified `bun rx:event-trigger`
    (6/6 gates pass, worker destroyed). `bun.lock` is unchanged from HEAD.
- **Recommendation:** stay on pinned `0.7.0` for now. A runtime upgrade means
  migrating the whole repo to Flue 1.0's `.flue/` + `defineWorkflow` + wrangler
  deploy model — a deliberate, separately-scoped project, not a pin bump. When
  done, re-run all E2Es (`bun rx:*`, `bun ex:*`, `bun tpl:*`).

---

## Artifacts / commands (reproducible)

```sh
# upstream
git clone --depth 30 https://github.com/withastro/flue /tmp/flue
cd /tmp/flue && corepack pnpm install --frozen-lockfile
corepack pnpm --filter @flue/runtime run build
corepack pnpm --filter @flue/runtime test          # 783 passed baseline

# behavior check across published versions
npm pack @flue/runtime@0.7.0   # webhook path: handler(ctx), no guard  -> silent {}
npm pack @flue/runtime@0.7.1   # guard string present, webhook still direct
npm pack @flue/runtime@0.8.0   # guarded
# main (1.0.0-beta.9): returning a Response -> HTTP 500 action_output_serialization
```

Key source anchors on `main`:
- `packages/runtime/src/runtime/handle-agent.ts` — `runSyncMode` (~L523),
  `executeWorkflowDefinition` (~L565), `startWorkflowExecution` (~L323).
- `packages/runtime/src/action.ts:126` — `runActionWithParsedInput` (output guard).
- `packages/runtime/src/json-snapshot.ts` — `cloneJsonSerializable` / `assertJsonLike`.
- `packages/runtime/src/errors.ts:825` — `ActionOutputSerializationError`.
