---
title: event-trigger
tagline: 'One signed-webhook front door that runs a Flue workflow on any upstream event — Sentry, PagerDuty, GitLab CI, cron.'
composes: [Workers AI, structured output, generic HMAC webhook]
---

# event-trigger

> One signed-webhook front door that runs a Flue workflow on any
> upstream event — Sentry, PagerDuty, GitLab CI, or a cron tick.

This recipe is the answer to a recurring ask: *"I'd love if we could have
Flue workflows in our repos tied to event triggers — run a Flue workflow
on a new Sentry event, a page, a cron, or a message in a team channel."*

The hard part isn't the workflow. It's the plumbing: normally you spin
up and manage a Worker separately, then expose it as an app each source
can call. A Flue-on-Cloudflare Worker collapses that into **one
deployable, one webhook URL**. And the common denominator across every
source is the same: **they can all send a signed webhook.**

## Composes

- **[Flue](https://flueframework.com)** 1.0 workflow — `defineWorkflow` + `session.prompt(..., { result })` with a [valibot](https://valibot.dev) schema for a drift-proof routing decision
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — the model (`cloudflare/@cf/moonshotai/kimi-k2.6`)
- **A single generic HMAC** — every upstream signs the event body the same way

## The pipeline

```
POST /workflows/event-trigger?wait=result
  body: { source, event, _sig }
        │
        ▼
  1. verify HMAC   one generic sha256(event, secret) any upstream can compute
        │          (unsigned / wrong-sig → { ok:false, status:401 })
        ▼
  2. normalize     src/lib/normalize.ts: N provider shapes → 1 CanonicalEvent
        │          { source, kind, title, severity, service, url }
        ▼
  3. route         session.prompt() + schema → { action, channel, reason }
        │          action ∈ page | notify | log
        ▼
  4. act           page/notify branch is where you fan out (queue, chat, PD…)
```

## What it proves

- **One auth scheme fits every source.** Sentry, PagerDuty, GitLab CI,
  and cron all authenticate with the *same* HMAC-SHA256 over the event
  body — the "generic webhook support" common denominator. Anything that
  can POST JSON and set a signature can trigger a workflow.
- **The normalizer is the integration boundary.** `src/lib/normalize.ts`
  collapses four provider-specific JSON shapes into one `CanonicalEvent`.
  Adding a source is one branch there (plus a signing quirk if the
  provider signs its own way). Everything downstream is source-agnostic.
- **The routing decision is structured and drift-proof.** `session.prompt`
  with a valibot `result` schema returns `action` (one of
  `page`/`notify`/`log`), a `channel`, and a `reason` — the LLM can't
  return a shape downstream code can't act on.
- **Severity maps sensibly.** A fatal Sentry error and a triggered
  PagerDuty incident normalize to `critical`; a failed GitLab pipeline to
  `high`; a cron tick to `info`. The E2E asserts each.

## Run

```sh
bun rx:event-trigger
# or: cd recipes/event-trigger && bash run-e2e.sh
```

`run-e2e.sh` builds with `flue build`, deploys with `wrangler`
(injecting `EVENT_HMAC_SECRET` via `--var`), runs the gateproof plan,
then deletes the Worker. Six gates:

| Gate | Sends | Expects |
|---|---|---|
| `rejects-unsigned` | no `_sig` | `ok:false`, 401 |
| `rejects-wrong-sig` | bad HMAC | `ok:false`, 401 |
| `routes-sentry` | signed fatal Sentry error | `critical` → page/oncall |
| `routes-pagerduty` | signed triggered incident | `critical` → page/oncall |
| `routes-gitlab-ci` | signed failed pipeline | `high` → notify/eng-alerts |
| `routes-cron` | signed cron tick | `info` → log |

~60s, ~$0.0001 in Workers AI usage.

> **Flue 1.0 note.** A workflow invoked with `?wait=result` always
> resolves HTTP 200 with the return value under `{ result }`. Auth
> failures are therefore signalled *in the body* as
> `{ ok:false, status:401 }`, and the probe asserts on that.

## Sending an event (any source)

Every upstream does the same two things: JSON-serialize the event body,
and sign it. In this snippet the signature rides inside `_sig` (see the
caveat below); a production custom fetch handler would read a real header.

```sh
BODY='{"kind":"deploy.finished","title":"prod deploy","severity":"low"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$EVENT_HMAC_SECRET" | awk '{print $2}')"

curl -sS -X POST "$WORKER_URL/workflows/event-trigger?wait=result" \
  -H 'content-type: application/json' \
  -d "{\"source\":\"generic\",\"event\":$BODY,\"_sig\":\"$SIG\"}"
```

- **Sentry**: point a webhook/internal integration at the URL; set
  `source: "sentry"`. Configure it to send the shared HMAC, or add a
  `sentry-hook-signature` branch in `src/lib/verify-signature.ts`.
- **PagerDuty**: a v3 webhook subscription; `source: "pagerduty"`.
- **GitLab CI**: a pipeline/job webhook, or a `curl` in `.gitlab-ci.yml`;
  `source: "gitlab-ci"`.
- **Cron**: a Cloudflare Cron Trigger (or any scheduler) that POSTs a
  small `{ kind, title, service }` body with `source: "cron"`.

## Files

| File | Role |
|---|---|
| `src/workflows/event-trigger.ts` | the front door: verify → normalize → route |
| `src/lib/verify-signature.ts` | one generic HMAC-SHA256 verify (constant-time) |
| `src/lib/normalize.ts` | per-source shape → one `CanonicalEvent` |
| `wrangler.jsonc` | name, `nodejs_compat`, migrations, `ai` binding |
| `gateproof.plan.ts` | 6 gates: 2 auth rejections + 4 source routes |
| `probe.ts` | signs fixtures, asserts normalization + routing |
| `run-e2e.sh` | build → deploy → assert → delete |

## Production wiring

This snippet stops short of touching real providers so the E2E stays
free and key-free. To ship it for real:

1. **Rotate `EVENT_HMAC_SECRET`** and set it as a real secret
   (`wrangler secret put EVENT_HMAC_SECRET`). Give each source that value
   out-of-band.
2. **Read the raw body.** This snippet carries the signature in `_sig`
   and HMACs `JSON.stringify(event)`, which is not byte-stable across
   senders. In production, add an `app.ts` with a custom Hono route that
   reads `c.req.raw` bytes, verifies against the provider's real signature
   header, then `invoke()`s this workflow — or model each provider as a
   first-party [channel](https://flueframework.com) (`@flue/github`,
   `@flue/slack`, …) which owns raw-body HMAC for you.
3. **Per-source verification.** If a provider signs with its own scheme
   (Sentry's `sentry-hook-signature`, GitLab's `X-Gitlab-Token`), branch
   on `source` in `src/lib/verify-signature.ts`. The normalizer already
   knows the source, so this is a small local change.
4. **Act on the decision.** Wire the `page`/`notify` branch to a real
   sink — a Queue producer, an incident tool, a team channel webhook. The
   `route` object is already structured for exactly this.
5. **Dedupe deliveries.** Providers retry. Persist the delivery id (in a
   DO or KV) and make handling idempotent.

## Known caveats

- **HMAC against re-serialized JSON.** As above, verification runs over
  `JSON.stringify(event)`, which is not byte-stable across senders. The
  probe controls the wire format so the E2E is exact; production wants a
  raw-body path (custom `app.ts` route or a first-party channel).
- **Routing is a model call.** The `route` decision is Workers AI. The
  probe pins the severity mapping (deterministic, in `normalize.ts`) and
  asserts the *action* falls in a sensible set per event — it doesn't
  demand one exact action, to stay robust to model variation.
