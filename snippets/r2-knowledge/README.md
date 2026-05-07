# 07 · Flue + R2 + VirtualSandbox

> Mount an R2 bucket as the agent's filesystem. Drop markdown in,
> agent finds it. No embeddings, no chunking, no vector DB.

## What it does

`getVirtualSandbox(env.KNOWLEDGE_BASE)` mounts the R2 bucket at
`/workspace` inside the agent's sandbox. The agent has bash: `grep`,
`glob`, `read`. To "ingest" new content, you `wrangler r2 object put` it
into the bucket.

## Why this matters

The default RAG playbook is: chunk documents, embed with a model, store
in a vector DB, retrieve top-k, hope. Each of those steps is a place to
fail and a thing to maintain. This snippet skips all of it. The agent's
bash is the retrieval engine; the R2 bucket is the store.

Works because: modern LLMs are good at navigating real filesystems.
Token budgets are big enough to read 5-10 markdown files in full. R2
list+get is fast.

This is the snippet that makes Cloudflare's "agent on the edge" story
real. The agent runs on Workers, the knowledge runs on R2, no separate
infrastructure to spin up.

## Cloudflare primitive in play

[`getVirtualSandbox`](https://github.com/withastro/flue#packages) —
Flue's R2-backed virtual filesystem. DO SQLite index. **No container.**

This is one of two Cloudflare-target sandbox primitives in Flue:

- **`getVirtualSandbox(env.R2_BUCKET)`** ← used here. Cheap, fast,
  read-mostly. Agent has bash for grep/glob/read but no real exec
  surface. Perfect for knowledge bases.
- **`getSandbox(env.Sandbox, id)`** ← Cloudflare Containers (DO + real
  Linux). Use when the agent needs to actually run code, build, edit
  files, etc. See snippet [13](../../batch-c/13-r2-gateproof) for that
  pattern.

Pick by the question "does the agent need to RUN things, or just READ
things?" Knowledge base = virtual sandbox. Doc edits + check command =
real sandbox.

## Lines of code

19.

## Run it

```bash
# 1. Drop content in the bucket
wrangler r2 object put my-kb/refunds.md --file=./refunds.md

# 2. Agent finds it
flue dev --target cloudflare
curl https://localhost:3583/agents/07-r2-knowledge \
  -d '{"message":"How do I issue a refund?"}'
```
