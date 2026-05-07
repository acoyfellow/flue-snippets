# 18 · Lab Checkpoint Receipts

> Long-running agents need receipts, not vibes.

## What it does

The agent writes a Lab receipt at meaningful moments: first cycle, every Nth
cycle, or explicit stop. The receipt stores the input, output, cycle, and stop
reason.

The minimal snippet takes `payload.cycle` and returns the incremented cycle. A
deployed version stores cycle state in the same DO that backs the Flue session.

## Why this matters

Persistence is not useful if you cannot audit it. This snippet turns continuity
into a replayable trail.

## Three-way proof

- Flue: stateful session and prompt.
- Alchemy Effect v2: Worker + DO + env declared as the deploy graph.
- Dogfood primitive: `@acoyfellow/lab` receipts.

## Sources

- Existing Lab snippet:
  `batch-a/01-lab-receipt/agent.ts`
- Existing Lab Alchemy sketch:
  `batch-a/01-lab-receipt/alchemy.run.ts`
- Alchemy Effect README:
  `~/cloudflare/alchemy-effect/README.md`
