# 13 · Flue + Cloudflare Sandbox + gateproof

> Agent edits docs in a real Linux container. gateproof runs the doc
> check command. Self-heals up to 3 attempts. Per Fred's canonical
> `flue add cloudflare` recipe.

## What it does

- `getSandbox(env.Sandbox, id)` — real Cloudflare Sandbox container
  (Durable Object + Containers).
- `session.skill('edit-doc', ...)` — agent edits the doc using its
  workspace.
- gateproof's `Plan` + `Gate.define({ act: [Act.exec('bun run check:docs')] })`
  runs the verification command inside the same workspace.
- If the gate fails, the agent reads the failure summary and revises.
- Capped at 3 attempts.

## Why this matters

Most "agent edits your docs" demos end at "the agent wrote *something*."
The interesting question is: *did it preserve what mattered?* That's an
executable contract, not a vibe check. gateproof gives you a hard yes/no
with the exec output attached. Cloudflare Sandbox gives you a real shell
where the doc check can actually run.

The pattern generalizes — replace "docs" with "config files," "test
fixtures," "marketing copy," "SQL migrations." Anywhere the agent edits
content AND there's a runnable rule the content must satisfy, this
snippet is the shape.

## Cloudflare primitives in play

- **Cloudflare Sandbox** ([`@cloudflare/sandbox`](https://github.com/cloudflare/sandbox)) — Durable Object + Cloudflare
  Containers. Real Linux, real shell. Per `flue add cloudflare --print`.
- **Workers** — runtime for the Flue agent itself.
- **gateproof** — the executable contract.

## Setup (per `flue add cloudflare`)

`wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "Sandbox", "class_name": "Sandbox" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Sandbox"] }],
  "containers": [{ "class_name": "Sandbox", "image": "./Dockerfile" }]
}
```

`Dockerfile`:

```dockerfile
FROM docker.io/cloudflare/sandbox:0.9.2
```

`package.json` deps: `@cloudflare/sandbox`, `gateproof`, `effect`.

## Lines of code

35.

## Run it

```bash
flue dev --target cloudflare

curl http://localhost:3583/agents/13-r2-gateproof/draft-1 \
  -d '{"file":"docs/intro.md","instruction":"add a getting-started example"}'
```
