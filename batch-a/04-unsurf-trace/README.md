# 04 · Flue + unsurf

> The agent visits a URL, every browser action becomes a typed trace,
> the trace becomes the agent's input. Browser work that's auditable.

## What it does

unsurf opens the URL inside an authenticated browser, runs the listed
actions, and produces both a recording (mp4) and a `proof-spec.v0` JSON
trace. The Flue agent then reads the trace and writes a summary.

## Why this matters

When agents do browser work, the usual pattern is "we trust the agent's
description of what happened." unsurf flips that: the *browser tells you
what happened*, in a typed schema, with a video to back it up. The agent
becomes a consumer of evidence, not the source of it.

The trace shape (`proof-spec.v0`) is the same one lab and gateproof
share. So a Flue agent could chain unsurf → gateproof → lab and end up
with one URL that contains: the video, the assertions, the receipt of
who ran it. No manual stitching.

## Cloudflare primitive in play

unsurf runs browser sessions on Cloudflare Browser Rendering (or a
self-hosted equivalent). The recording lives in R2. The trace is signed
and served by a CF Worker.

## Lines of code

24.

## Run it

```bash
flue run 04-unsurf-trace \
  --payload '{"url":"https://example.com","actions":[{"type":"click","selector":"a"}]}'
```
