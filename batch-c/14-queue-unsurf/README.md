# 14 · Flue + Queues + unsurf

> Hourly regression checks across N URLs. Failed assertions ship with
> a video + proof URL straight to the alert channel.

## What it does

- Cron fires hourly, enqueues every monitored URL onto the regression
  queue.
- Queue consumer pops one, runs unsurf with the standard action set,
  captures the trace and recording.
- If any assertion fails, push the proof URL + video to the alerts
  queue (Discord, Slack, PagerDuty, whatever consumes alerts).

## Why this matters

Synthetic monitoring is usually one of two things: simple HTTP probes
(don't catch UI regressions) or expensive E2E SaaS (charges per minute,
brittle waiters, no native video). This snippet is the cheap version:

- Queues + Cron = scheduled, retry-safe execution at Cloudflare's free
  tier.
- unsurf = browser actions captured as `proof-spec.v0` traces with video.
- The alert payload is the proof URL — operators don't have to log in
  anywhere to see what broke. Open the URL, watch the video, see the
  assertion that failed.

This generalizes to anything queue-shaped: regression checks, scrapers,
periodic agent runs, fan-out crawls.

## Cloudflare primitives in play

[Queues](https://developers.cloudflare.com/queues/) +
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
+ Browser Rendering (via unsurf).

## Lines of code

35.

## wrangler.toml

```toml
[triggers]
crons = ["0 * * * *"]

[[queues.consumers]]
queue = "regression"
[[queues.producers]]
queue = "regression"
binding = "REGRESSION_QUEUE"
[[queues.producers]]
queue = "alerts"
binding = "ALERTS"
```
