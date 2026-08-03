---
title: email-workers
tagline: 'Send a real email via Cloudflare Email Service from a Flue agent.'
composes: [Email Service, Workers AI]
---

# email-workers

> Send a real email via Cloudflare Email Service from a Flue agent.

The Flue 2 agent uses Workers AI to draft a short body, then calls the
`send_email` tool. That tool sends mail with `env.EMAIL.send()`, the
Cloudflare Email Service Workers binding. No simulation: a successful call
hits the real Email Service pipeline and returns a `messageId`.

> **Beta + paid plan.** Cloudflare Email Service is currently in beta and
> requires the Workers Paid plan. See
> [Email Service docs](https://developers.cloudflare.com/email-service/).
> The repo's other examples are free-tier; this one isn't.

## Prerequisites

To actually send mail and have the E2E assert a real send:

1. **Onboard a domain for sending** in the Cloudflare dashboard at
   [Email Service → Sending](https://dash.cloudflare.com/?to=/:account/email-service/sending).
   This adds the cf-bounce subdomain, plus SPF / DKIM / DMARC records to your
   DNS. DNS propagation usually finishes in 5-15 minutes.
2. Export two environment variables before running the E2E:
   ```sh
   export EMAIL_FROM="alerts@your-onboarded-domain.com"
   export EMAIL_TO="you@example.com"
   ```

Without these, the agent still deploys. The E2E reports the structured error
code (`E_MISSING_EMAIL_FROM`, `E_SENDER_NOT_VERIFIED`, and so on) and does not
fail the run.

## Run

```sh
bash examples/email-workers/run-e2e.sh
```

The E2E builds with Vite, deploys the Worker, POSTs an email request to
`/agents/email-workers/<conversationId>`, then polls that URL until the tool
output settles. It accepts either a real `messageId` or a structured `E_*`
error, then deletes the Worker.

## What the agent does

```ts
const sendEmail = defineTool({
  name: 'send_email',
  async run({ data }) {
    const { messageId } = await env.EMAIL.send({
      to: env.EMAIL_TO,
      from: env.EMAIL_FROM,
      subject: data.subject,
      text: data.text,
    });
    return { output: { ok: true, messageId } };
  },
});
```

The binding does the heavy lifting: authentication, SPF/DKIM signing,
queueing, retries, and delivery telemetry.

## Files

| File | Role |
|---|---|
| `src/agents/email-workers.ts` | the Flue agent and Email Service tool |
| `src/app.ts` | Workers AI provider and agent route |
| `run-e2e.sh` | deploy, conversation polling, and teardown |
| `README.md` | this file |

## See also

- [Workers API for Email Sending](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), full `send()` interface, attachments, headers
- [REST API for Email Sending](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/), same thing from non-Workers contexts
- [Onboarding a domain](https://developers.cloudflare.com/email-service/get-started/send-emails/#set-up-your-domain)
- The legacy [Email Routing → email() handler](https://developers.cloudflare.com/email-routing/email-workers/) pattern (inbound). That is a separate example; this snippet owns the Worker entrypoint and focuses on sending mail.
