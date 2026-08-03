---
title: event-trigger
tagline: 'Authenticate webhooks at an explicit route, then route the normalized event with an agent tool.'
composes: [Workers AI, signed webhooks, Durable Agents]
---

# event-trigger

`src/app.ts` owns the webhook boundary. `POST /events/:source/:conversationId` reads the raw request body, verifies `x-event-signature`, and only then admits a normalized event to the agent. Invalid signatures receive HTTP 401 before durable admission.

The agent mounts `route_event`, which normalizes Sentry, PagerDuty, GitLab CI, cron, and generic payloads into one event vocabulary and returns a deterministic `{ action, channel, reason }` routing decision. This keeps signature verification at the transport edge and model-facing work in a tool.

## Route

The webhook endpoint returns HTTP 202. Read `GET /agents/event-trigger/<conversationId>` until its conversation snapshot contains the routing response.

## Run

```sh
bash recipes/event-trigger/run-e2e.sh
```

The probe covers rejected signatures and representative source payloads.
