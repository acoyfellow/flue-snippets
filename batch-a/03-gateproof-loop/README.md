# 03 · Flue + gateproof

> Agent works, gates verify, agent reads its own failure receipt, retries.
> Self-healing in 22 lines.

## What it does

Flue agent attempts a task in its sandbox. After each attempt, gateproof
runs the user-supplied plan against the workspace and produces a proof
URL. If the proof passes, return. If it fails, the agent reads the
failure reason in the next prompt and tries again. Capped at 3.

## Why this matters

The "agent does the work" half is well-trodden. The "did it actually
work?" half is not. gateproof gives you a hard yes/no with an explanation
attached. Combined with Flue's session persistence, the agent can read
its own previous failures and adjust — without you in the loop.

This is the receipts/proof/gates cluster's signature pattern: *the artifact
of a failed run is the input to the next attempt.*

## Cloudflare primitive in play

gateproof itself runs locally or on Workers; the proof URL is served from
Cloudflare. The Flue sandbox here is `local` (the agent works in your
checkout). For container-isolated runs, swap `sandbox: 'local'` for
Daytona or `getVirtualSandbox`.

## Lines of code

22.

## Run it

```bash
flue run 03-gateproof-loop \
  --payload '{"task":"add a CHANGELOG entry","plan":"./gateproof.plan.ts"}'
```
