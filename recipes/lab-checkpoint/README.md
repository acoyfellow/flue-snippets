---
title: lab-checkpoint
tagline: 'Durable cycle state creates receipts at meaningful checkpoints.'
composes: [Durable Agents, lab]
---

# lab-checkpoint

`LabCheckpoint` stores its cycle in durable agent state. Its `checkpoint_agent_work` tool answers the delivered message, increments that state, and writes a Lab receipt at cycle one, each configured interval, and explicit stop. Other cycles return no receipt.

## Route

Send user messages to `POST /agents/lab-checkpoint/<conversationId>` and poll the same URL after HTTP 202. Reuse a conversation id to continue its checkpoint counter.

## Run

```sh
bash recipes/lab-checkpoint/run-e2e.sh
```
