---
title: github-app
tagline: 'A forkable GitHub App on Cloudflare Workers, powered by Flue channels.'
composes: [Flue channels, Workers AI, Durable Objects, '@flue/github']
---

# github-app

> A forkable GitHub App on Cloudflare Workers, powered by a Flue **channel**.

This is a **template**, not a snippet. Fork the folder, set a webhook
secret, and you have a working GitHub App: verified webhook ingress that
dispatches issue and pull-request opens to a triage agent. Production-shape,
real HMAC signature verification, multi-event routing, on Flue 2.0 +
Cloudflare Workers AI.

## What you get

- ✅ Real HMAC-SHA256 verification over the **raw request body** via
  [`@flue/github`](https://flueframework.com) (`x-hub-signature-256`). no
  re-serialization hacks; bad/missing signature → `401`
- ✅ Multi-event routing: `issues.opened` and `pull_request.opened`
- ✅ Each event `dispatch()`es to a per-issue/PR **agent instance**
  (keyed by the channel's `conversationKey`)
- ✅ Workers AI as the model, free-tier friendly, no third-party keys
- ✅ Gateproof E2E covering rejected-unsigned, rejected-wrong-sig, accepted-signed

## Fork & deploy

```sh
# 1. Clone or copy this folder into your repo
cp -r templates/github-app my-gh-app && cd my-gh-app

# 2. Generate a strong webhook secret (keep it safe)
openssl rand -hex 32

# 3. Build + deploy (inject the secret as a var/secret)
bun install
npx vite build
npx wrangler deploy --config dist/flue-tpl-github-app/wrangler.json \
  --var "GITHUB_WEBHOOK_SECRET:<the secret from step 2>"
# For production, prefer: npx wrangler secret put GITHUB_WEBHOOK_SECRET

# 4. Register the GitHub App on github.com
#    - Webhook URL: https://<your-worker>.workers.dev/channels/github/webhook
#    - Webhook secret: <the secret from step 2>
#    - Permissions: Issues (R/W), Pull requests (R/W), Metadata (R)
#    - Events: Issues, Pull request
#    - Content type: application/json
```

To comment back on GitHub, add an `@octokit/rest` client + a
[tool](https://flueframework.com) bound to the triage agent (see the
upstream `@flue/github` channel example); this template keeps the agent
dispatch-only so the E2E stays key-free.

## Composes

- **[Flue channels](https://flueframework.com)**. `@flue/github`'s `createGitHubChannel` owns the verified ingress boundary (HMAC over raw body, typed deliveries) at `POST /channels/github/webhook`
- **[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)**. `cloudflare/@cf/moonshotai/kimi-k2.6`
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**. one triage agent instance per issue/PR (auto-generated `FlueTriageAgent`)

## What's in here

```
templates/github-app/
├── README.md
├── src/
│   ├── channels/github.ts   # createGitHubChannel: verify → dispatch to triage agent
│   └── agents/triage.ts     # the agent each issue/PR is dispatched to
├── wrangler.jsonc           # name, nodejs_compat, migrations, ai binding
├── gateproof.plan.ts        # 3 gates: unsigned / wrong-sig / signed
├── probe.ts                 # signs a real x-hub-signature-256 delivery
└── run-e2e.sh               # build → deploy → assert → delete
```

## Customising

**Add a new event handler**: in `src/channels/github.ts`, add a branch on
`delivery.name` / `delivery.payload.action` and `dispatch()` to an agent
with a stable instance id (use `channel.conversationKey(ref)` so the same
issue/PR always lands in the same agent instance).

**Comment back**: initialize an `@octokit/rest` client from a
`GITHUB_TOKEN` and expose a narrow `defineTool` on the triage agent that
calls `issues.createComment` for the bound issue/PR.

**Use a different model**: change the `model:` string in
`src/agents/triage.ts`.

## Production checklist

- [ ] Set `GITHUB_WEBHOOK_SECRET` via `wrangler secret put` (rotate periodically)
- [ ] Use a GitHub App installation token (short-lived) for outbound Octokit calls
- [ ] Route the model through an [AI Gateway](https://developers.cloudflare.com/ai-gateway/) (see `recipes/ai-gateway`)
- [ ] Deduplicate on `delivery.deliveryId`. GitHub retries deliveries
- [ ] Add [`@acoyfellow/lab`](https://www.npmjs.com/package/@acoyfellow/lab) receipts for a replay-inspectable audit trail (see `recipes/lab-receipt`)
- [ ] Set up [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/) to retain failures

## Test it locally

```sh
bun tpl:github-app
# or: cd templates/github-app && bash run-e2e.sh
```

The harness builds, deploys an ephemeral Worker, runs three signature
gates against `/channels/github/webhook` (the probe signs a real
`x-hub-signature-256` HMAC), then deletes it. ~60s, ~$0.0001.

Because `@flue/github` verifies the **raw** request body, unsigned and
wrong-signature deliveries get a genuine `401` at the edge, and a
correctly-signed `issues.opened` returns `200` after dispatching to the
triage agent.
