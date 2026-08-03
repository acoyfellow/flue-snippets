# Flue 1.0-beta.9 → 2.0 migration recipe

Proven end-to-end on `examples/kv` with a real Cloudflare deploy:

```
round-trip assertion passed: kv_round_trip reported match:true for e2e-kv
zero leftover workers after teardown: flue-snippet-kv absent
```

Use `examples/kv` as the reference implementation. Copy its shape.

## Traps found the hard way — read before starting

1. **`vite` must be `^8.2.0`.** With vite 7.x the `'use agent'` scanner throws
   `Unable to parse ... Expected ',', got 'ident'` on **any** TypeScript
   syntax, because vite 7's `parseAstAsync` cannot parse TS. It looks exactly
   like broken source; it is not. A 6-line agent still fails.
2. **`cloudflare()` needs `flueWorkerConfig()`:**
   `plugins: [flue(), cloudflare({ config: flueWorkerConfig() })]`
3. **Per-package `.npmrc`** containing
   `@cloudflare:registry=https://registry.npmjs.org/`, and install with
   `env -u NPM_TOKEN -u npm_config_registry bun install`. Otherwise
   `@cloudflare/*` resolves to an Access-gated internal registry and fails.
   This repo is **public**: verify the lockfile leaks nothing with
   `grep -icE 'cloudflare-ui|cfdata|cloudflareaccess' bun.lock` → must be `0`.
4. **A model that actually runs needs the `ai` binding.** The 1.0 snippets
   declared a model but never prompted it, so its absence was invisible.
   Missing it fails at runtime with
   `Cannot read properties of undefined (reading 'run')`.
5. **Per-package `tsconfig.json`** — the root one requires `vitest/globals`,
   which snippet packages do not install.
6. **Avoid a bare all-caps/short agent name like `R2`.** Deployed, an agent
   named `R2` fails every prompt with
   `prompt failed across the Durable Object boundary` / `internal error`,
   even though it typechecks, builds, and generates a valid-looking
   `FlueR2Agent` class. Renaming the function to `R2Storage` — same tool,
   same bucket, same config — makes it pass with `match:true`. Prefer a
   descriptive PascalCase agent name (`R2Storage`, `KvStore`).
7. **Cold start is slow.** A freshly deployed Worker can 500 or refuse
   admission for ~10s. Harnesses and probes must RETRY admission, not fail
   on the first non-202.

## Files per package

- `src/agents/<name>.ts` — `'use agent'` directive, exported PascalCase
  function, exactly one `useModel()`. The Cloudflare binding is exposed as a
  `defineTool` mounted with `useTool`. A tool's `run` returns
  `{ output: ... }` — a bare object throws `ToolOutputSerializationError`.
- `src/app.ts`:
  ```ts
  setProvider(cloudflareBindingProvider({ binding: (env as unknown as { AI: Ai }).AI }));
  app.route('/agents/<name>', createAgentRouter(<Agent>));
  ```
- `vite.config.ts`, `tsconfig.json`, `.npmrc` (see `examples/kv`)
- `wrangler.jsonc` — add `"ai": { "binding": "AI" }`; replace the old
  workflow/registry migrations with a single
  `{ "tag": "flue-2-class-Flue<Name>Agent", "new_sqlite_classes": ["Flue<Name>Agent"] }`
  (class name derives from the agent function name, camel boundaries split).
- `package.json` — deps `@flue/runtime ^2.0.0`, `hono ^4.12.33`,
  `valibot ^1.4.0`; dev `@flue/cli ^2.0.0`, `@flue/vite ^2.0.1`,
  `@cloudflare/vite-plugin ^1.50.0`, `vite ^8.2.0`, `wrangler`, `typescript`,
  `@cloudflare/workers-types`. Scripts: `dev`/`build`/`check`.
- Delete `src/workflows/`. `export const route` and `WorkflowRouteHandler`
  are gone.

## Harness (`run-e2e.sh`)

- `npx flue build --target cloudflare` → `npx vite build`. The dist layout
  (`dist/<worker_name>/wrangler.json`) is unchanged.
- `POST /workflows/<name>?wait=result` is **gone**. Flue 2 routes are
  `POST /agents/<name>/<conversationId>` returning **202**, then
  `GET` the same URL to read the settled conversation.
- Keep the existing create/teardown and the
  `zero leftover workers after teardown` check exactly as they are.

## Removed APIs — must not appear anywhere

`defineWorkflow`, `defineAgent`, `WorkflowRouteHandler`, `export const route`,
`invoke()`, `flue build`, `flue dev`, `?wait=`, `/workflows/`.
