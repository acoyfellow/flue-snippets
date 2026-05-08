# queues

> Agent enqueues a message. Producer-only hello world.

```sh
bash examples/queues/run-e2e.sh
```

`env.QUEUE.send(message)`. The test asserts the send returned 200 with
`status: enqueued`. Adding a Queue Consumer Worker is the next step;
see Cloudflare's Queues docs.
