---
title: email-workers
tagline: 'Send a real email via Cloudflare Email Service from a Flue agent.'
composes: [Email Service, Workers AI]
---

# email-workers

> Send a real email via Cloudflare Email Service from a Flue agent.

The Flue agent receives a webhook payload, asks Workers AI to draft a
short body, then sends the email with `env.EMAIL.send()`, the
Cloudflare Email Service Workers binding. No simulation: the call hits
the real Email Service pipeline and returns a `messageId`.

> **Beta + paid plan.** Cloudflare Email Service is currently in beta
> and requires the Workers Paid plan. See
> [Email Service docs](https://developers.cloudflare.com/email-service/).
> The repo's other examples are free-tier; this one isn't.

## Prerequisites

To actually send mail (and have the E2E assert "real email sent"):

1. **Onboard a domain for sending** in the Cloudflare dashboard at
   [Email Service → Sending](https://dash.cloudflare.com/?to=/:account/email-service/sending).
   This adds the cf-bounce subdomain, plus SPF / DKIM / DMARC records
   to your DNS. DNS propagation usually finishes in 5-15 minutes.
2. Export two env vars before running the E2E:
   ```sh
   export EMAIL_FROM="alerts@your-onboarded-domain.com"
   export EMAIL_TO="you@example.com"
   ```

Without these, the agent still deploys; the E2E logs a `⚠ no real
email sent` warning and reports the structured error code
(`E_MISSING_EMAIL_FROM`, `E_SENDER_NOT_VERIFIED`, etc.) but does not
fail the run.

## Run

```sh
bash examples/email-workers/run-e2e.sh
```

What happens:

1. `flue build --target cloudflare` produces the Worker.
2. `alchemy deploy` declares the `EMAIL` binding via alchemy's
   `EmailSender({...})` resource, restricting the binding to the
   sender/recipient pair you exported.
3. The harness POSTs `{ subject, context }` to the agent.
4. The agent calls `env.EMAIL.send({...})`.
5. If `ok:true` + `messageId` → a real email is on its way to `$EMAIL_TO`.
6. `alchemy destroy` tears the Worker down.

## What the agent does

```ts
const ai = await env.AI.run('@cf/moonshotai/kimi-k2.6', {
  prompt: `Draft a short, plain-text email body about: ${context}`,
});
const { messageId } = await env.EMAIL.send({
  to: env.EMAIL_TO,
  from: env.EMAIL_FROM,
  subject,
  text: ai.response.trim(),
  html: `<p>${escapeHtml(ai.response)}</p>`,
});
```

That's the whole thing, the binding does the heavy lifting (auth,
SPF/DKIM signing, queueing, retries, delivery telemetry).

## Files

| File | Role |
|---|---|
| `email-workers.ts` | the Flue agent, AI body + real `EMAIL.send()` |
| `run-e2e.sh` | shim into the shared `scripts/run-example.sh` |
| `README.md` | this file |

## See also

- [Workers API for Email Sending](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), full `send()` interface, attachments, headers
- [REST API for Email Sending](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/), same thing from non-Workers contexts
- [Onboarding a domain](https://developers.cloudflare.com/email-service/get-started/send-emails/#set-up-your-domain)
- The legacy [Email Routing → email() handler](https://developers.cloudflare.com/email-routing/email-workers/) pattern (inbound). That's a different example, Flue owns the Worker entrypoint, so receiving mail requires wrapping its generated entry, which is out of scope for this minimal snippet.
