# 13 · Flue + R2 + gateproof

> Agent edits docs in an R2-mounted filesystem. Gateproof verifies they
> still pass the contract. Self-heals up to 3 attempts.

## What it does

R2 bucket mounted as the agent's workspace. Agent runs an `edit-doc`
skill. After each edit, gateproof runs gates from `./gates/docs-quality.ts`:
links work, tone preserved, no secrets leaked, headings hierarchy intact.
If a gate fails, the agent reads the failing reason and revises.

## Why this matters

Most "agents edit your docs" demos end at "the agent wrote *something*."
The interesting question is: *did it preserve what mattered?* That's a
gate, not a vibe check. gateproof gives you executable contracts. R2 gives
you the persistent workspace so changes survive across runs.

The composition is what's powerful:
- R2 = source of truth (docs survive, can be diffed against history).
- gateproof = the contract (machine-checkable, no human-eyeballing).
- Flue = the agent loop (read-edit-verify-retry, all in 25 LOC).

Replace "docs" with "config files," "test fixtures," "marketing copy" —
the pattern generalizes. Any time you have *content the agent edits* and
*rules the content must satisfy*, this snippet is the shape.

## Cloudflare primitives in play

R2 (storage) + Workers (Flue runtime) + Cloudflare Containers via
`getVirtualSandbox` (the bash environment). gateproof itself runs locally
within the agent's sandbox.

## Lines of code

29.

## Run it

```bash
flue dev --target cloudflare

curl http://localhost:3583/agents/13-r2-gateproof \
  -d '{"file":"docs/intro.md","instruction":"add a getting-started example"}'
```
