# 05 · Flue + capa

> The agent decides to refund. capa executes the refund without ever
> showing the agent the Stripe key. The receipt is the audit trail.

## What it does

The Flue agent classifies the user's message into "refund this much / don't
refund." If refund, capa hits Stripe with a capability-bounded token —
Stripe key never enters the agent's context. capa returns both the Stripe
response and structured `evidence` (request ID, account ID, audit fields).

## Why this matters

The "agent makes API calls" pattern usually means handing the agent a
secret. capa inverts that: agents call capa, capa is the only thing that
holds the secret, capa scopes the token to the exact action the agent has
been authorized for. Refund-only agent can't issue charges. Read-only
agent can't write.

Combined with Flue's `commands` model (where secrets stay outside the
agent's session), this is a real two-layer capability story:
- Flue: agent never sees credentials at the runtime level.
- capa: the credentials *capa* uses are themselves scoped to the action.

The audit story writes itself.

## Cloudflare primitive in play

capa is a Cloudflare Worker that proxies typed third-party API calls. The
capability tokens are minted by capa's control plane and bound to specific
actions. Built for Stripe, GitLab, Jira; extensible to anything with an
OpenAPI spec.

## Lines of code

26.

## Run it

```bash
flue run 05-capa-stripe \
  --payload '{"message":"customer wants $50 back","chargeId":"ch_abc"}'
```
