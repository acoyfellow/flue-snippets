---
title: github-app
tagline: 'A forkable GitHub App webhook handler on Cloudflare Workers, powered by Flue.'
composes: [Workers AI, Durable Objects, octokit, valibot]
---

# github-app

> A forkable GitHub App webhook handler on Cloudflare Workers, powered by Flue.

This is a **template**, not a snippet. Fork the folder, set a few
secrets, and you have a working GitHub App that triages issues and
flags PR risk with structured output. Production-shape — signature
verification, multi-event routing, audit-ready receipts via Flue +
Cloudflare's Workers AI.

## What you get

- ✅ HMAC-SHA256 webhook signature verification (constant-time compare)
- ✅ Multi-event routing — `issues.opened` and `pull_request.opened`
- ✅ Structured-output triage via Flue skills + `valibot` schemas
  (severity / reproducible / summary)
- ✅ Comment posted back to the issue with the triage result
- ✅ Workers AI as the model — free-tier friendly, no third-party keys
- ✅ Durable Object per webhook delivery (geo-pinned, restart-safe)
- ✅ Gateproof E2E covering rejected-unsigned, rejected-wrong-sig, accepted-signed

## Fork & deploy

```sh
# 1. Clone or copy this folder into your repo
cp -r templates/github-app my-gh-app
cd my-gh-app

# 2. Generate a strong webhook secret (keep it safe)
openssl rand -hex 32

# 3. Set deployment env vars
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export GITHUB_WEBHOOK_SECRET=<the secret from step 2>
export GITHUB_TOKEN=<your GH App installation token>

# 4. Deploy
bun install
npx flue build --target cloudflare --workspace . --output .build
npx alchemy deploy --stage prod

# 5. Register the GitHub App on github.com
#    - Webhook URL: https://<your-worker>.workers.dev/agents/webhook/main
#    - Webhook secret: <the secret from step 2>
#    - Permissions: Issues (R/W), Pull requests (R/W), Metadata (R)
#    - Events: Issues, Pull request
```

## Composes

- **[Flue](https://flueframework.com)** — agent shape, skills, structured output
- **[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)** — `@cf/moonshotai/kimi-k2.6`
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — Flue auto-creates one per webhook delivery
- **[`@octokit/core`](https://github.com/octokit/core.js)** — tiny GitHub REST client
- **[`valibot`](https://valibot.dev)** — runtime schema for structured output

## What's in here

```
templates/github-app/
├── README.md
├── agents/webhook.ts        # entry: verify signature, route by event, call skill
├── lib/
│   ├── verify-signature.ts  # HMAC-SHA256 via Web Crypto, constant-time compare
│   └── github.ts            # Octokit wrapper (post issue comment)
├── skills/
│   ├── triage.md            # severity + reproducible + summary
│   └── pr-review.md         # risk + summary + suggested reviewers
├── alchemy.run.ts           # Worker + DO bindings + secrets
├── gateproof.plan.ts        # 3 gates: unsigned / wrong-sig / signed
├── probe.ts                 # multi-mode fetch probe
└── run-e2e.sh               # deploy → assert → destroy
```

## Customising

**Add a new event handler** (3 steps):

1. In `agents/webhook.ts`, add a branch:
   ```ts
   if (event === 'release' && hook.action === 'published') {
     // call a new skill, post a comment somewhere, etc.
   }
   ```
2. Drop a new skill prompt in `skills/<your-skill>.md`.
3. Add a matching `valibot` schema in `agents/webhook.ts` and call
   `session.skill('<your-skill>', { args, schema })`.

**Use a different model**: change the `model:` string in `agents/webhook.ts`.
Any model supported by Flue's runtime works — Workers AI, OpenRouter, etc.

**Skip the comment post**: set `GITHUB_TOKEN` to empty. The webhook
still triages, but the result only goes back in the HTTP response.

## Production checklist

- [ ] Rotate `GITHUB_WEBHOOK_SECRET` periodically (use `wrangler secret put`)
- [ ] Use a GitHub App installation token (short-lived) instead of a PAT
- [ ] Add an [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
  binding for cost tracking and rate limiting (see `examples/ai-gateway/`)
- [ ] Add structured logging — push every `handled` result to D1 or
  Analytics Engine for a triage audit log
- [ ] Add [`@acoyfellow/lab`](https://www.npmjs.com/package/@acoyfellow/lab)
  receipts so each delivery is replay-inspectable (see `recipes/lab-receipt`)
- [ ] Set up [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/)
  to retain failures
- [ ] Add a circuit-breaker for upstream GitHub rate limits

## Known caveats

- **HMAC against parsed JSON.** Flue's current `FlueContext` exposes
  `payload` (parsed JSON), not the raw request bytes. This template
  re-serializes the payload with `JSON.stringify` before HMAC. The
  probe controls the wire format, so the E2E passes; in production
  against real GitHub deliveries you'll want to switch to a custom
  Worker fetch handler that calls `request.text()` and verifies before
  parsing. See the TODO at the top of `agents/webhook.ts`. Track this
  on the Flue side at https://flueframework.com.

## Test it locally

```sh
bash templates/github-app/run-e2e.sh
```

The harness deploys an ephemeral Worker, runs all three gates against
it, and tears it down. Takes ~60s, costs ~$0.0001.
