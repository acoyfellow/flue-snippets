# lab-checkpoint

> Receipts at meaningful moments: start, every Nth cycle, stop.

## Composes

- **[Flue](https://flueframework.com)** — agent shape
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — per-user DO holds the cycle counter
- **[`@acoyfellow/lab`](https://lab.coey.dev)** — receipts persisted per checkpoint

## What it proves

- The agent writes a Lab receipt at cycle 1, every Nth cycle, and on explicit `stop: true`
- Mid-cycle calls (e.g. cycle 2 with `every: 3`) return no `receipt` field
- `lab.coey.dev` actually persists what the agent claimed to write — the receipt URL the agent returns resolves to a real saved result

## Run

```sh
bash snippets/lab-checkpoint/run-e2e.sh
```

Three gates: a checkpoint cycle (proves persist), a non-checkpoint cycle
(proves selectivity), and a lab-origin reachability check.

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/lab-checkpoint.ts` | 31 | the snippet |
| `alchemy.run.ts` | 25 | Worker + DO + LAB_URL var |
| `gateproof.plan.ts` | 64 | 3 gates |
| `probe-first.ts` | 40 | asserts first-cycle receipt persists |
| `probe-mid.ts` | 30 | asserts mid-cycle skip |
| `run-e2e.sh` | 53 | standard harness |
