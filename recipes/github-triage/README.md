---
title: github-triage
tagline: 'The canonical Flue demo — triage a GitHub issue with structured output.'
composes: [Workers AI, Durable Objects, Flue skills]
---

# github-triage

> The canonical Flue demo — triage a GitHub issue with structured output.

## Composes

- **[Flue](https://flueframework.com)** — agent shape, skills, structured output via a [valibot](https://valibot.dev) schema
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — the model (`@cf/meta/llama-4-scout-17b-16e-instruct`)
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — Flue auto-creates one per agent

## What it proves

- A Flue `session.skill()` call wired to a valibot schema gives you
  output the LLM **cannot drift from** — `severity` is always one of
  four enum values, `reproducible` is always a boolean, `summary` is
  always a string.
- The skill prompt lives next to the code in `skills/triage.md` — no
  inline prompt strings, no separate prompt repo.
- The same agent runs in CI via `flue run` **or** as a real GitHub
  webhook handler; the shape doesn't change.

## Run

```sh
bash recipes/github-triage/run-e2e.sh
```

The probe POSTs a synthetic issue body with clear reproduction steps
and asserts the structured triage carries the right shape and values.

## Production wiring

This snippet stops short of touching a real repo so the E2E stays
free and key-free. To turn it into a real GitHub App:

1. **Add a `GITHUB_TOKEN` binding** in `alchemy.run.ts` — a fine-grained
   PAT (or a GitHub App installation token) with `issues:write` on the
   target repo.
2. **Verify the webhook signature** — read `X-Hub-Signature-256` and
   HMAC the raw body with your webhook secret before trusting the
   payload. ([Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries))
3. **Read `payload.issue.body`** from the real GitHub webhook payload
   instead of the inline shape the snippet uses.
4. **Post the comment back** with [`@octokit/rest`](https://github.com/octokit/rest.js):
   ```ts
   import { Octokit } from '@octokit/rest';
   const gh = new Octokit({ auth: env.GITHUB_TOKEN });
   await gh.issues.createComment({
     owner, repo,
     issue_number: payload.issue.number,
     body: `**Triage** (severity: \`${triage.severity}\`, reproducible: \`${triage.reproducible}\`)\n\n${triage.summary}`,
   });
   ```

The agent's body — `session.skill('triage', { args, schema })` — does
not change at all. Everything new lives at the edges.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/github-triage.ts` | 53 | the snippet — Flue skill + valibot schema |
| `skills/triage.md` | 19 | the skill prompt (versioned next to the code) |
| `alchemy.run.ts` | 40 | Worker + DO binding |
| `gateproof.plan.ts` | 45 | 1 gate: probe asserts structured triage shape |
| `probe.ts` | 89 | POST a synthetic issue, assert shape + values |
| `run-e2e.sh` | 58 | orchestrates the lifecycle (deploy, warmup, assert, destroy) |
