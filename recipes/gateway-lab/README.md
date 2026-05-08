# gateway-lab

> Two observability planes composed: gateway sees traffic, lab sees work.

## Composes

- **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)** — model traffic plane (latency, cost, cache hits, retries)
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** — `@cf/meta/llama-3.1-8b-instruct`
- **[`@acoyfellow/lab`](https://lab.coey.dev)** — work plane (input, output, capabilities)
- **[Flue](https://flueframework.com)** — agent shape

## What it proves

- The model call goes through AI Gateway (caching, observability)
- Each call also writes a Lab receipt with the input + output + gateway id used
- `lab.coey.dev` serves the receipt back — the agent's claim of "I logged this" is verifiable
- Same prompt, two complete audit trails: gateway logs the request shape, lab logs the work shape

## Run

```sh
export CLOUDFLARE_GATEWAY_ID=jordan  # or your gateway name

bash snippets/gateway-lab/run-e2e.sh
```

## Files

| File | LOC | Role |
|---|---:|---|
| `agents/gateway-lab.ts` | 32 | the snippet |
| `alchemy.run.ts` | 31 | Worker + AI binding + DO + LAB_URL + GATEWAY_ID |
| `gateproof.plan.ts` | 53 | 2 gates: gateway+lab + lab origin |
| `probe.ts` | 53 | asserts answer + receipt + gateway echo |
| `run-e2e.sh` | 88 | standard harness |
