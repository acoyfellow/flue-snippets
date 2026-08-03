---
title: github-triage
tagline: 'Triage a GitHub issue with a validated tool result.'
composes: [Workers AI, Durable Agents, valibot]
---

# github-triage

The `triage_github_issue` tool runs a harness prompt constrained by a Valibot schema. Its output always contains a severity enum, reproducibility boolean, and one-sentence summary. The agent calls that tool for the delivered issue and returns its result.

## Route

`POST /agents/github-triage/<conversationId>` accepts a user message and returns HTTP 202. Poll `GET` on the same URL for the conversation snapshot.

## Run

```sh
bash recipes/github-triage/run-e2e.sh
```
