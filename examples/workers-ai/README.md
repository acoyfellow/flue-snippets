---
title: workers-ai
tagline: 'The simplest Cloudflare Flue agent: call a model and return its answer.'
composes: [Workers AI]
---

# workers-ai

> The simplest Cloudflare Flue agent: call a model and return its answer.

```sh
cd examples/workers-ai && bun install && bash run-e2e.sh
```

`WorkersAi` is a synchronous Flue 2 agent. It calls `useModel()` once with
`cloudflare/@cf/moonshotai/kimi-k2.6` and returns its instructions. `app.ts`
registers the Cloudflare Workers AI binding and mounts the agent at
`/agents/workers-ai`.

Send a user message to `POST /agents/workers-ai/<conversationId>`. The route
admits it with `202`; `GET` the same URL to read the settled conversation and
its non-empty assistant answer. The E2E builds and deploys the Worker, checks
that answer, then deletes the Worker.
