# 10 · Flue + Workers for Platforms

> Become a multi-tenant host for Flue agents. Each tenant uploads code,
> it deploys isolated, with its own R2 + capability set.

## What it does

A "dispatcher" Worker routes by subdomain (`alice.agents.example.com` →
tenant `alice`'s Flue agent). New tenants register via the platform API,
which uploads their Flue agent code as a child Worker with bindings
specific to that tenant: own R2 bucket, own AI binding, own Durable
Objects.

## Why this matters

This is the "lab.coey.dev/compose, but for Flue agents at scale" play.
Today:
- Lab Compose lets you run JS snippets in a sandbox. One isolate per run.
- This snippet pattern lets users *deploy their own Flue agent* on top of
  your infrastructure, with V8 isolation, with the bindings they need,
  with their own data segregated.

If you ever wanted to build the agent-platform play (one URL, many
tenants, each running their own thing), Workers for Platforms makes it a
~30-line dispatcher. The rest is just an upload API.

This is also the natural endgame for the Studio idea (REBOOT loop 3):
v1 = your snippets in your repo, v2 = anyone's snippets in their tenant.

## Cloudflare primitive in play

[Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/) —
the multi-tenant primitive that powers Cloudflare Pages, Workers Builds,
and a bunch of customer-facing platforms. Per-tenant V8 isolation +
per-tenant bindings.

## Lines of code

22 (the dispatcher; the Flue agent code each tenant uploads is separate).

## Run it

```bash
# Deploy the dispatcher
flue build --target cloudflare
wrangler deploy

# Register a tenant
curl https://your-platform.example.com/admin/register \
  -d '{"name":"alice","code":"<flue agent TS>"}'

# Tenant uses their agent
curl https://alice.agents.example.com -d '{"message":"hello"}'
```
