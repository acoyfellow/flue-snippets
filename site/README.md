# site

The showcase site for [`flue-snippets`](../). A guided demo of Flue on
Cloudflare Workers, deployed to [flue.coey.dev](https://flue.coey.dev).

## Stack

- [Astro 5](https://astro.build), static site generation, content collections, Shiki syntax highlighting
- [alchemy](https://alchemy.run), declarative Worker + Assets + CustomDomain
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/), hosting

No CSS framework, no React, no client-side runtime. Just `.astro` files
with scoped styles and one inline `<script>` for the search input.

## Data flow

```text
../examples/<slug>/README.md   ┐
../recipes/<slug>/README.md    ├─► content collections (glob loader)
../templates/<slug>/README.md  ┘            │
                                            ▼
                              src/lib/snippets.ts (typed accessors)
                                            │
                                            ▼
                              src/pages/index.astro (tour + cards + FAQ)
```

Each snippet README has YAML frontmatter:

```yaml
---
title: workers-ai
tagline: 'The simplest CF Flue agent: call a model, return the answer.'
composes: [Workers AI]
---
```

The body of the README stays untouched and lives on GitHub; the card on
the showcase site links there with `View on GitHub →`.

## Local dev

```sh
cd site
bun install
bun run dev
```

Astro serves on `http://localhost:4321`. Edits to any snippet README are
picked up on the next request.

## Deploy

CI does this automatically on every push to `main` that touches `site/`
or any snippet README, see [`.github/workflows/site.yml`](../.github/workflows/site.yml).

To deploy manually from your laptop:

```sh
export CLOUDFLARE_API_TOKEN=...   # Workers Scripts:Edit + Zone:Edit
export CLOUDFLARE_ACCOUNT_ID=...
bun run deploy                     # astro build && alchemy deploy
```

`alchemy.run.ts` wraps `./dist` in a tiny Worker (`./worker.ts`) whose
only job is `env.ASSETS.fetch(request)`. The `CustomDomain` resource
attaches `flue.coey.dev` to it on the `prod` stage (only).

To preview without binding the custom domain:

```sh
STAGE=preview bun run deploy
# → printed *.workers.dev URL only; flue.coey.dev untouched
```

To tear it all down:

```sh
bun run destroy
```

## Adding a new snippet

1. Add the folder under `../examples`, `../recipes`, or `../templates`.
2. Prepend YAML frontmatter to its `README.md` matching the schema in
   `src/content/config.ts`.
3. CI redeploys on the next push.
