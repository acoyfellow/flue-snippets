---
title: dynamic-workflow
tagline: 'Runtime-selected tasks coordinated by one durable Flue agent instance.'
composes: [Durable Agents, tool orchestration]
---

# dynamic-workflow

Flue 2 removed the framework-managed orchestration endpoint that this recipe originally demonstrated. It cannot reproduce runtime-created Cloudflare step graphs inside Flue.

The replacement is an agent that owns a durable per-conversation completion log and orchestrates a tool for each incoming task. Send task commands to one conversation id; the tool accepts the task, records the processed result, and returns the ordered log. This preserves the useful lesson: the work shape is selected at runtime and the same durable instance owns its state.

For a platform-level multi-step process that must survive interruptions independently of an agent response, use Cloudflare Workflows outside Flue and call an agent through an awaited `init()` handle as documented by Flue 2.

## Route

`POST /agents/dynamic-workflow/<conversationId>` admits `{ "kind": "user", "body": "<JSON command>" }` with HTTP 202. Read the same URL until the conversation snapshot contains the completed response.

## Run

```sh
bash recipes/dynamic-workflow/run-e2e.sh
```

The probe sends three runtime-defined tasks to one conversation and verifies that their values are retained in order.
