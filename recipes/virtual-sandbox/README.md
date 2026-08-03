---
title: virtual-sandbox
tagline: 'Seed an in-memory just-bash sandbox from R2 and inspect it with agent tools.'
composes: [R2, Workers AI, Durable Agents, just-bash]
---

# virtual-sandbox

Flue 2 no longer provides the former bucket-mounted sandbox helper. This recipe uses `useSandbox(bash(() => new Bash({ fs: new InMemoryFs(...) })))` instead. `seed_knowledge_base` keeps R2 as the source of truth, copies its documents into the virtual filesystem, and the agent uses the sandbox tools to inspect those documents.

## Route

`POST /agents/virtual-sandbox/<conversationId>` accepts a user message and returns HTTP 202. Poll `GET` on the same URL until the answer is present.

## Run

```sh
bash recipes/virtual-sandbox/run-e2e.sh
```
