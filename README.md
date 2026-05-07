# flue-snippets

Hero snippets where each one is a [Flue](https://flueframework.com) agent
that uses a Jordan primitive, a Cloudflare primitive, or both — in 15-40
lines.

> **The thesis:** [Flue](https://flueframework.com) (Fred Schott / Astro /
> Cloudflare) is the discipline. If a primitive composes cleanly with a Flue
> agent, it's a snippet. If it doesn't, that's a library issue, not a Flue
> issue. Volume is the moat.

> **The discipline (in two stages):**
>
> 1. **Local pre-push:** `agent-ci` runs the GitHub Actions workflow in a
>    bind-mounted Docker container before push. Pause-on-failure means an
>    agent (or you) can fix and retry without burning a remote CI cycle.
> 2. **Remote post-push:** GitHub Actions runs the same workflow on every
>    push to `main`. Green badge ↓ is the load-bearing signal.
>
> ![ci](https://github.com/acoyfellow/flue-snippets/actions/workflows/test.yml/badge.svg)
>
> If the local stage passes and the remote fails, that's a real environment
> bug worth diagnosing. If both pass, the snippet ships.

---

## Run the tests

### Locally (post-edit, pre-commit)

```bash
bun install
LAB_URL=https://lab.coey.dev bun test
```

Expected: **N pass / 0 fail** (currently 8/8 across 4 pilot snippets).

### Locally (pre-push, full GH Actions surface)

One-time setup for Colima users:

```bash
sudo ln -sf "$HOME/.colima/docker.sock" /var/run/docker.sock
```

Then:

```bash
npx @redwoodjs/agent-ci run --workflow .github/workflows/test.yml --quiet
```

This runs the **exact same** workflow GitHub Actions would, against the
**official runner image**, with `~/.bun` and `node_modules` bind-mounted
for ~0ms cache hits on subsequent runs.

If a step fails, the run pauses. Fix the issue, then:

```bash
npx @redwoodjs/agent-ci retry --name <runner-name>
```

(See `.agents/skills/agent-ci/SKILL.md` for the full agent loop.)

### Remotely (push to main)

`.github/workflows/test.yml` runs on every push + PR + manual dispatch.
Live results: <https://github.com/acoyfellow/flue-snippets/actions>

---

## Why this repo exists

A Flue agent is small enough that the *combination* is the value:

```
Flue agent shape  ×  Jordan's primitive  ×  Cloudflare primitive
                                                        = a snippet nobody else can write
```

Most agent code today is either "wrap an SDK" or "fork Claude Code." Flue
gives you a third option: a tiny TypeScript framework where the agent's
shape is consistent enough that adding *one* primitive — a memory store,
a sandbox, a receipt — is genuinely a 1-2 line change in the snippet.

Each snippet here demonstrates a specific composition. Together they map
the surface area where Flue + the Cloudflare ecosystem + the Jordan
portfolio earn each other.

---

## The 15 snippets

### Batch A — Flue + ONE Jordan primitive

Foundational. Each shows how a single library plugs in.

| # | Title | Primitive | LOC |
|---|---|---|---:|
| [01](batch-a/01-lab-receipt) | Run a prompt → get a permalink | [`@acoyfellow/lab`](https://github.com/acoyfellow/lab) | 22 |
| [02](batch-a/02-deja-memory) | Recall before, remember after | [`@acoyfellow/deja`](https://github.com/acoyfellow/deja) | 26 |
| [03](batch-a/03-gateproof-loop) | Self-healing via gates | [`@acoyfellow/gateproof`](https://github.com/acoyfellow/gateproof) | 22 |
| [04](batch-a/04-unsurf-trace) | Browser actions as typed traces | [`@acoyfellow/unsurf`](https://github.com/acoyfellow/unsurf) | 24 |
| [05](batch-a/05-capa-stripe) | Refund without seeing the Stripe key | [`@acoyfellow/capa`](https://github.com/acoyfellow/capa) | 26 |

### Batch B — Flue + ONE Cloudflare primitive

The CF primitives that make agents actually work in production.

| # | Title | Primitive | LOC |
|---|---|---|---:|
| [06](batch-b/06-ai-gateway) | Cached, observable, rate-limited prompts | [AI Gateway](https://developers.cloudflare.com/ai-gateway/) | 15 |
| [07](batch-b/07-r2-knowledge) | R2 bucket as the agent's filesystem | [R2 + VirtualSandbox](https://github.com/withastro/flue) | 19 |
| [08](batch-b/08-do-session) | Per-user DO-backed agent sessions | [Durable Objects](https://developers.cloudflare.com/durable-objects/) | 12 |
| [09](batch-b/09-queue-cron) | Scheduled rig in the cloud, no PID file | [Queues + Cron](https://developers.cloudflare.com/queues/) | 22 |
| [10](batch-b/10-platforms) | Multi-tenant Flue agent host | [Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/) | 22 |

### Batch C — Full sandwich (Flue + Cloudflare primitive + Jordan primitive)

Where it gets interesting. The snippets nobody else can write.

| # | Title | Primitives | LOC |
|---|---|---|---:|
| [11](batch-c/11-gateway-lab) | Gateway sees traffic, lab sees work | AI Gateway + lab | 29 |
| [12](batch-c/12-do-deja) | Two memory layers, no overlap | DO sessions + deja | 30 |
| [13](batch-c/13-r2-gateproof) | Edit docs in R2, gate the result | R2 + gateproof | 29 |
| [14](batch-c/14-queue-unsurf) | Hourly regression checks with video | Queues + unsurf | 35 |
| [15](batch-c/15-platforms-capa) | Multi-tenant agents handle money | Workers for Platforms + capa | 37 |

**Total: 323 LOC across 15 snippets** (excluding comments + blanks).
Average: **21 LOC per snippet**.

---

## The discipline (the gate)

A snippet ships only if:

1. It's a runnable Flue agent (`init` + `session` + `prompt/skill/shell/task`).
2. It uses **at least one named primitive** (Jordan or Cloudflare).
3. It demonstrates something that's **distinctive** at this density.
4. Lines stay tight (15-40 ideal, 60 max).
5. It has a 1-paragraph "why this matters" essay alongside.

If a primitive doesn't compose cleanly with Flue, the snippet doesn't ship.
That's the constraint that drives library reshape work organically — but
*the reshape happens because a snippet wants to exist*, not as a separate
project.

---

## What's NOT in the first batch (intentional)

- Snippets that combine **two Jordan primitives**. Those are batch D.
- Snippets that combine **two Cloudflare primitives** without a Jordan
  primitive. Less interesting; CF docs already cover this.
- Snippets that wrap external SaaS (OpenAI fine-tuning, Pinecone, Supabase).
  Not in scope; this repo is the Cloudflare-aligned slice.
- Production-grade examples with auth, rate limiting, error handling.
  Snippets are *demos*, not templates. They show the composition. Hardening
  is on you.

---

## Roadmap

The next batches, ordered:

- **Batch D** — Flue + 2 Jordan primitives (lab+deja, gateproof+unsurf,
  capa+lab, etc.). Lots of natural pairs.
- **Batch E** — Flue + 2 Cloudflare primitives + 1 Jordan primitive.
  Three-stack snippets where the CF primitives are doing complementary
  work (e.g., DO + Vectorize + deja, Queues + R2 + gateproof).
- **Batch F** — Real-world workflows that compose 3+ snippets together.
  The "this is what a production agent looks like" set.

The repo is open. Each snippet is its own folder. Forking one and tweaking
it for your stack is the intended use.

---

## License

MIT. Build whatever you want.

---

*Maintained by [@acoyfellow](https://github.com/acoyfellow). Part of the
[coey.dev](https://coey.dev) portfolio.*
