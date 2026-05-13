---
title: hyperdrive
tagline: 'Flue agent queries Postgres through a Hyperdrive binding.'
composes: [Hyperdrive]
---

# hyperdrive

> Flue agent queries Postgres through a Hyperdrive binding.

```sh
export HYPERDRIVE_CONNECTION_STRING='postgres://user:pass@host:5432/db'
bash scripts/run-example.sh hyperdrive
```

The agent uses the `postgres` driver against
`env.HYPERDRIVE.connectionString` and runs:

```sql
SELECT NOW() as now, 'hello from pg' as msg
```

## Limitation

This example **requires a real Postgres database** that Hyperdrive can
reach. Set `HYPERDRIVE_CONNECTION_STRING` before running the e2e , 
without it, alchemy provisions the Hyperdrive resource against a
placeholder and the actual query will fail (though the binding wiring,
build, and deploy still succeed).

The e2e assertion is intentionally loose: it just verifies the agent
deployed and the endpoint returns *something* (even a Postgres
connection error, which proves the binding is plumbed correctly).

See [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/).
