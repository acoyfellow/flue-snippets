---
title: event-trigger
tagline: 'One signed-webhook front door that runs a Flue workflow on any upstream event — Sentry, PagerDuty, GitLab CI, cron.'
composes: [Workers AI, Durable Objects, Flue skills]
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

- **[Flue](https://flueframework.com)**, agent shape + `session.skill()` with a [valibot](https://valibot.dev) schema for the routing decision
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)**, the model (`@cf/moonshotai/kimi-k2.6`)
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)**, Flue auto-creates one per agent (durable, geo-pinned)

## The pipeline

```
POST /agents/event-trigger/<id>
  body: { source, event, _sig }
        │
        ▼
  1. verify HMAC   one generic sha256(body, secret) any upstream can compute
        │          (unsigned / wrong-sig → result.ok=false, 401)
        ▼
  2. normalize     lib/normalize.ts: N provider shapes → 1 CanonicalEvent
        │          { source, kind, title, severity, service, url }
        ▼
  3. route         Flue prompt() + schema → { action, channel, reason }
        │          action ∈ page | notify | log
        ▼
  4. act           page/notify branch is where you fan out (queue, chat, PD…)
```

## What it proves

- **One auth scheme fits every source.** Sentry, PagerDuty, GitLab CI,
  and cron all authenticate with the *same* HMAC-SHA256 over the event
  body. That's the "generic webhook support" common denominator —
  anything that can POST JSON and set a header can trigger a workflow.
- **The normalizer is the integration boundary.** `lib/normalize.ts`
  collapses four provider-specific JSON shapes into one `CanonicalEvent`.
  Adding a source is one branch there (plus a signing quirk if the
  provider signs its own way). Everything downstream is source-agnostic.
- **The routing decision is structured and drift-proof.** The Flue skill
  returns `action` (one of `page`/`notify`/`log`), a `channel`, and a
  `reason` — the LLM can't return a shape downstream code can't act on.
- **Severity maps sensibly.** A fatal Sentry error and a triggered
  PagerDuty incident normalize to `critical`; a failed GitLab pipeline to
  `high`; a cron tick to `info`. The E2E asserts each.

## Run

```sh
bash recipes/event-trigger/run-e2e.sh
```

Six gates run against the deployed Worker:

| Gate | Sends | Expects |
|---|---|---|
| `rejects-unsigned` | no `_sig` | 401 |
| `rejects-wrong-sig` | bad HMAC | 401 |
| `routes-sentry` | signed fatal Sentry error | 200, `critical`, page/notify |
| `routes-pagerduty` | signed triggered incident | 200, `critical`, page/notify |
| `routes-gitlab-ci` | signed failed pipeline | 200, `high`, page/notify |
| `routes-cron` | signed cron tick | 200, `info`, log/notify |

~60s, ~$0.0001 in Workers AI usage.

## Sending an event (any source)

Every upstream does the same two things: JSON-serialize the event body,
and set the HMAC header. In this snippet the signature rides inside
`payload._sig` (see the caveat below); a production custom fetch handler
would read a real header instead.

```sh
BODY='{"kind":"deploy.finished","title":"prod deploy","severity":"low"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$EVENT_HMAC_SECRET" | awk '{print $2}')"

curl -sS -X POST "$WORKER_URL/agents/event-trigger/$(uuidgen)" \
  -H 'content-type: application/json' \
  -d "{\"source\":\"generic\",\"event\":$BODY,\"_sig\":\"$SIG\"}"
```

- **Sentry**: point a webhook/internal integration at the URL; set
  `source: "sentry"`. Configure it to send the shared HMAC, or add a
  `sentry-hook-signature` branch in `lib/verify-signature.ts`.
- **PagerDuty**: a v3 webhook subscription; `source: "pagerduty"`.
- **GitLab CI**: a pipeline/job webhook, or a `curl` in `.gitlab-ci.yml`;
  `source: "gitlab-ci"`.
- **Cron**: a Cloudflare Cron Trigger (or any scheduler) that POSTs a
  small `{ kind, title, service }` body with `source: "cron"`.

## Files

| File | Role |
|---|---|
| `agents/event-trigger.ts` | the front door: verify → normalize → route |
| `lib/verify-signature.ts` | one generic HMAC-SHA256 verify (constant-time) |
| `lib/normalize.ts` | per-source shape → one `CanonicalEvent` |
| `skills/route.md` | the routing-decision skill prompt |
| `alchemy.run.ts` | Worker + DO binding + `EVENT_HMAC_SECRET` |
| `gateproof.plan.ts` | 6 gates: 2 auth rejections + 4 source routes |
| `probe.ts` | signs fixtures, asserts normalization + routing |
| `run-e2e.sh` | deploy → warmup → assert → destroy |

## Production wiring

This snippet stops short of touching real providers so the E2E stays
free and key-free. To ship it for real:

1. **Rotate `EVENT_HMAC_SECRET`** and set it as a real secret
   (`wrangler secret put` or the alchemy binding). Give each source that
   value out-of-band.
2. **Read the raw body.** Flue's `FlueContext` exposes `payload` (parsed
   JSON), not the raw request bytes. HMAC needs a byte-stable body, so
   this snippet carries the signature in `payload._sig` and HMACs
   `JSON.stringify(payload.event)`. In production, export a custom Worker
   `fetch` handler that reads `request.text()`, verifies against the
   provider's real signature header, then dispatches to the Flue agent.
3. **Per-source verification.** If a provider signs with its own scheme
   (Sentry's `sentry-hook-signature`, GitLab's `X-Gitlab-Token`), branch
   on `source` in `lib/verify-signature.ts`. The normalizer already knows
   the source, so this is a small local change.
4. **Act on the decision.** Wire the `page`/`notify` branch to a real
   sink — a Queue producer, an incident tool, a team channel webhook. The
   `route` object is already structured for exactly this.
5. **Dedupe deliveries.** Providers retry. Use the auto-generated
   `EventTrigger` DO (keyed by delivery id) to make handling idempotent.

## Known caveats

- **HMAC against re-serialized JSON.** As above, until Flue exposes the
  raw request, verification runs over `JSON.stringify(payload.event)`,
  which is not byte-stable across senders. The probe controls the wire
  format so the E2E is exact; production wants the `request.text()` path.
  Track the Flue-side API at https://flueframework.com.
- **Routing is a model call.** The `route` skill is Workers AI. The
  probe pins severity mapping (deterministic, in `normalize.ts`) and only
  asserts the *action* falls in a sensible set per event — it does not
  demand one exact action, to stay robust to model variation.
