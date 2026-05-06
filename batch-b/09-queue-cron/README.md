# 09 · Flue + Queues + Cron

> A cron schedules an objective. A queue consumer runs the Flue agent.
> Failures retry. The local rig, in the cloud, with no PID file.

## What it does

`wrangler.toml` defines a 15-minute cron + a queue consumer. The cron
handler enqueues an objective. The queue consumer runs the Flue agent
on it. If the agent throws, the queue retries with exponential backoff.
If it succeeds, the message ACKs.

## Why this matters

The local rig pattern (the-machine, ralph, loop, etc.) is: a process
loops, reads an objective, runs an agent, writes a receipt, sleeps. The
process can die. The disk can die. The loop is fragile.

Cloudflare Queues + Cron Triggers is the same pattern with
infrastructure-grade durability:

- Cron fires on time even if there's no live process.
- Queue ACKs are at-least-once with retry backoff built in.
- Dead-letter queues catch the failures you couldn't recover.
- Concurrency is "however many consumers you spin up."

This is the snippet that makes "lift the rig into the cloud" concrete. The
PID file goes away. The menubar app becomes optional. The rig is just a
Cloudflare Worker.

## Cloudflare primitive in play

[Cloudflare Queues](https://developers.cloudflare.com/queues/) +
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
Free tier covers low-volume rigs.

## Lines of code

22 (functional) + ~10 wrangler.toml config.

## wrangler.toml

```toml
[triggers]
crons = ["*/15 * * * *"]

[[queues.consumers]]
queue = "rig-jobs"
max_batch_size = 1

[vars]
CURRENT_OBJECTIVE = "ship the next snippet"
```
