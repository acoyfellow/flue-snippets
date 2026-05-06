# 12 · Flue + DO sessions + deja

> Two memory layers, two scopes, no overlap. The DO knows this turn.
> Deja knows the user's history. The agent gets both.

## What it does

- **DO session** (Cloudflare): keyed on `userId`, holds the message
  history of *this conversation*. Lives milliseconds-to-hours.
- **Deja recall** (Jordan's memory): scoped to `userId`, holds *across-
  conversation* learnings. Lives days-to-months.
- The Flue agent reads both before responding. New significant exchanges
  get persisted to Deja.

## Why this matters

Memory in agent systems usually devolves into one of two failure modes:
1. **All in one store** — conversation history bloats, retrieval
   suffers, no separation between "what we just said" and "what was
   ever true."
2. **Manual scope juggling** — each developer reinvents the boundary
   between session memory and persistent memory.

DOs + Deja gives you the boundary for free. DO scope = single conversation.
Deja scope = the user (or team, or org). The agent sees both layered, and
the developer never writes glue code.

This is the snippet that demonstrates the *time-scale* observation from
the convergence analysis: Flue handles minutes-to-hours; Deja handles
days-to-weeks; they're complementary, not competing. Same idea, two
primitives, one agent.

## Cloudflare primitive in play

[Durable Objects](https://developers.cloudflare.com/durable-objects/)
for per-user persistent session.
[Deja](https://deja.coey.dev) for cross-session vector memory (CF Workers
+ Vectorize).

## Lines of code

30.

## Run it

```bash
DEJA_URL=https://deja.coey.dev flue dev --target cloudflare

# First conversation
curl http://localhost:3583/agents/12-do-deja/alice \
  -d '{"userId":"alice","message":"I prefer concise answers","persist":true}'

# Days later, new conversation
curl http://localhost:3583/agents/12-do-deja/alice \
  -d '{"userId":"alice","message":"Explain quantum entanglement"}'
# → concise answer, because Deja recalled the preference
```
