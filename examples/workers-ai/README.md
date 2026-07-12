---
title: workers-ai
tagline: 'The simplest CF Flue 1.0 workflow: call a model, return the answer.'
composes: [Workers AI]
---

# workers-ai

> The simplest CF Flue 1.0 workflow: call a model, return the answer.

```sh
cd examples/workers-ai && bun install && bash run-e2e.sh
```

A Flue **workflow** whose agent runs `cloudflare/@cf/moonshotai/kimi-k2.6`.
The `cloudflare` provider auto-registers on the Cloudflare target from the
`AI` binding in `wrangler.jsonc` — no `app.ts` needed unless you want to
customize the AI Gateway.

The workflow accepts `POST /workflows/workers-ai?wait=result` with an
optional `{ message }`, runs `session.prompt(...)`, and returns
`{ answer }`. The E2E builds, deploys the Worker, asserts a non-empty
answer, then deletes the Worker.
