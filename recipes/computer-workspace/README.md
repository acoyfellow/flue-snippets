---
title: computer-workspace
tagline: 'A durable agent filesystem with @cloudflare/computer, backed by the agent Durable Object SQLite. No container.'
composes: ['@cloudflare/computer', Durable Objects, Workers AI]
---

# computer-workspace

Give a Flue 2.0 agent a real filesystem with
[`@cloudflare/computer`](https://blog.cloudflare.com/cloudflare-computer).

The files live in the SQLite database that the agent Durable Object already has.
There is no container to boot, no volume to attach, and no second service. The
workspace persists because the Durable Object persists, so the same conversation
id sees the same disk on a later request.

## The idea

`@cloudflare/computer` needs one thing: an object with a `sql` property. A
Durable Object gives you `ctx.storage`, which has exactly that shape.

```ts
const { agent } = getCurrentAgent();
return new Workspace({ storage: agent.ctx.storage });
```

Flue 2.0 generates the Durable Object class for the agent, so `getCurrentAgent()`
from the `agents` SDK returns the live instance inside a tool. The agent function
stays a plain function.

## The tools

| Tool | What it does |
|---|---|
| `write_note` | Writes a file under `/notes`. |
| `read_note` | Reads one file back. |
| `list_notes` | Lists the files with `fs.readdir`. |
| `grep_notes` | Searches the files with `fs.grep`. |

`grep` is the interesting one. It runs against real stored bytes, so the model is
searching a filesystem instead of re-reading its own prompt.

## Run it

```sh
bun rx:computer-workspace
```

The E2E deploys a Worker, then asserts four things:

1. The agent writes `spell.md` with a random sentinel.
2. A **separate** HTTP request reads the same file back.
3. `grep` finds the sentinel inside the workspace.
4. A different conversation id starts with an empty disk.

Step 2 is the real claim. Step 4 proves the disk is per-instance and not global.

The Worker is deleted when the test finishes.

## Security

This Worker holds an `AI` binding on a public `workers.dev` URL, so every
`/agents/*` route requires an `x-api-key` header that matches `SNIPPET_API_KEY`.
The harness generates a new key for each run and injects it with
`wrangler deploy --var`. Requests without the key get a `401`.
