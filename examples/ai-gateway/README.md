---
title: ai-gateway
tagline: 'Workers AI through a Cloudflare AI Gateway. Caching, observability, retries — for free.'
composes: [AI Gateway, Workers AI]
---

# ai-gateway

> Workers AI through a Cloudflare AI Gateway. Caching, observability,
> retries — for free.

```sh
export CLOUDFLARE_GATEWAY_ID=jordan  # or your gateway name
bash examples/ai-gateway/run-e2e.sh
```

`env.AI.run(model, args, { gateway: { id } })`. The binding does its
own auth, so the deploy token doesn't need AI Gateway perms.
