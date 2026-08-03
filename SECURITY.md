# Security

These snippets deploy real Workers to your Cloudflare account, hit
real Workers AI / R2 / D1 / KV / Queues / etc., and write real Lab
receipts. They are not sandboxed.

## Inbound auth on deployed snippets

Every snippet deploys to a public `*.workers.dev` URL and binds Workers AI.
An unauthenticated Worker with an AI binding is an open door to your account,
so **every agent route is gated on a shared secret**:

```ts
app.use('/agents/*', async (c, next) => {
  const expected = env.SNIPPET_API_KEY;
  if (!expected || c.req.header('x-api-key') !== expected) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});
```

`run-e2e.sh` generates a fresh random `SNIPPET_API_KEY` per run and injects it
with `wrangler deploy --var`. Verified live: no key and a wrong key both get
`401`; only the correct key gets `202`.

`templates/github-app` is the exception. It mounts no agent route at all — its
only inbound surface is the GitHub webhook, whose `x-hub-signature-256` HMAC is
verified against the raw body before the handler runs.

If you fork these snippets, keep that guard. Removing it while an AI binding is
attached exposes your account to anyone who learns the URL.

## What to do if you find a security issue

Email **jcoeyman@gmail.com** with a clear description and reproduction
steps. Don't open a public issue.

## What's in scope

- Snippet code paths in [`examples/`](examples) and [`recipes/`](recipes)
- The `run-e2e.sh` lifecycle (build, deploy, warmup, assert, destroy)
- The GitHub Actions workflow ([`.github/workflows/e2e.yml`](.github/workflows/e2e.yml))

## What's out of scope

- Vulnerabilities in upstream packages, report those to the package
  authors:
  - [Flue](https://github.com/withastro/flue)
  - [alchemy](https://github.com/sam-goodwin/alchemy)
  - [Cloudflare Workers runtime](https://github.com/cloudflare/workerd)
- Cloudflare account misconfiguration on your end (token scope, etc.)

## Token hygiene

Every example uses `CLOUDFLARE_API_TOKEN` from your environment. The
README recommends a token scoped to **only** the products you actually
run. Don't paste a global API key.
