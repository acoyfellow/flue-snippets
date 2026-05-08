# durable-objects

> Each path segment is its own DO instance. Two POSTs to `/.../alice`
> share state; `/.../alice` and `/.../bob` don't.

```sh
bash examples/durable-objects/run-e2e.sh
```

The agent just echoes its `id` so the test can show two paths route to
two distinct DO instances. See [`recipes/do-session`](../../recipes/do-session)
for memory across turns and [`recipes/do-governor`](../../recipes/do-governor)
for explicit state machines.
