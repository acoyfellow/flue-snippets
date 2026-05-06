# 15 · Flue + Workers for Platforms + capa

> Multi-tenant agent platform. Each tenant has their own Stripe account
> via capa. Per-V8 isolation. Per-tenant scoped tokens. Zero leakage.

## What it does

The platform's dispatcher (snippet 10) routes by tenant. Each tenant runs
the same Flue agent code, but with bindings specific to them: their R2
workspace, their DO, their **capa token scoped to their Stripe account**.

When the agent decides to issue a refund, it uses `env.CAPA_TOKEN` —
which capa's control plane provisioned for that tenant alone, scoped to
*that tenant's* Stripe charges. The agent literally cannot refund a
different tenant's customer.

## Why this matters

Building a multi-tenant agent platform that handles money usually means:
- Per-tenant secrets management (HashiCorp Vault, AWS KMS, etc.).
- Per-tenant action authorization (custom IAM, OPA policies, …).
- Audit trail per tenant (CloudTrail, Datadog, custom logging).
- Tenant isolation (containers, VPCs, separate clusters).

Workers for Platforms + capa collapses all four:
- **V8 isolation** is the tenant boundary. Native to Cloudflare.
- **capa token** is the per-tenant capability scope. Tokens are bounded
  to specific accounts AND specific actions (refunds, not charges).
- **The agent's input/output is the audit trail.** capa's evidence field
  attaches request IDs the auditor can verify upstream.
- No Vault, no KMS, no OPA, no separate logging — the platform primitives
  handle it.

This is the snippet for a cofounder pitch: "you want to build a SaaS
where customers' AI agents talk to their Stripe / GitLab / Jira
accounts? Here's the 40-line foundation."

## Cloudflare primitives in play

[Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)
for tenant isolation + per-tenant bindings.
[capa](https://github.com/acoyfellow/capa) for capability-scoped third-
party API access.

## Lines of code

37.

## Run it

```bash
# Register a tenant with their scoped capa token
curl https://your-platform.example.com/admin/register \
  -d '{"name":"alice", "capaToken":"capa_token_for_alice_stripe"}'

# Their customer talks to their agent
curl https://alice.agents.example.com \
  -d '{"message":"refund my $50 order","chargeId":"ch_..."}'
```
