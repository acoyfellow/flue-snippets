# Security

These snippets deploy real Workers to your Cloudflare account, hit
real Workers AI / R2 / D1 / KV / Queues / etc., and write real Lab
receipts. They are not sandboxed.

## What to do if you find a security issue

Email **jcoeyman@gmail.com** with a clear description and reproduction
steps. Don't open a public issue.

## What's in scope

- Snippet code paths in [`examples/`](examples) and [`recipes/`](recipes)
- The `run-e2e.sh` lifecycle (build, deploy, warmup, assert, destroy)
- The GitHub Actions workflow ([`.github/workflows/e2e.yml`](.github/workflows/e2e.yml))

## What's out of scope

- Vulnerabilities in upstream packages — report those to the package
  authors:
  - [Flue](https://github.com/withastro/flue)
  - [alchemy](https://github.com/sam-goodwin/alchemy)
  - [Cloudflare Workers runtime](https://github.com/cloudflare/workerd)
- Cloudflare account misconfiguration on your end (token scope, etc.)

## Token hygiene

Every example uses `CLOUDFLARE_API_TOKEN` from your environment. The
README recommends a token scoped to **only** the products you actually
run. Don't paste a global API key.
