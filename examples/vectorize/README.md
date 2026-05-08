# vectorize

> Embed text via Workers AI, store + query in Vectorize. One upsert,
> one query, top match.

```sh
bash examples/vectorize/run-e2e.sh
```

`@cf/baai/bge-base-en-v1.5` produces 768-dim embeddings; the agent
upserts one and queries top-k=1. Real semantic search at the edge.
