# Contributing

Thanks for considering a contribution. Here's the shape this repo
expects.

## Adding a new example, recipe, or template

Each new folder under [`examples/`](examples), [`recipes/`](recipes),
or [`templates/`](templates) must ship the same lifecycle:

```
<folder>/
├── README.md           # one-pager: what it composes, what it proves, how to run
├── agents/<name>.ts    # the Flue agent (or vanilla Worker module)
├── alchemy.run.ts      # the resource graph (Worker + bindings + vars)
└── run-e2e.sh          # build → deploy → warmup → assert → destroy
```

Recipes additionally have:

```
├── gateproof.plan.ts   # the assertion plan (1+ gates)
└── probe.ts            # the actual fetch+JSON assertion (one per gate)
```

Templates have the same shape as recipes, plus typically: a richer
README aimed at people who will fork and ship (setup guide, production
checklist), additional `lib/` helpers, and one or more `skills/*.md`
prompt files. Templates are "fork me" code, where examples and recipes
are "read me" code.

## Tests

There's no `bun test` runner. The test for a snippet is its
`run-e2e.sh`. Run yours locally before opening a PR; the matrix
deploys the same script in CI.

## Lint

```sh
bun lint        # check
bun lint:fix    # auto-fix what's safe
```

Biome config is in [`biome.json`](biome.json).

## Wire up CI

After adding a folder, also append it to:

- [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml), both the
  dropdown and the matrix.
- [`package.json`](package.json), a new `ex:<name>`, `rx:<name>`, or
  `tpl:<name>` script.
- [`README.md`](README.md), the relevant table.

## PR checklist

- [ ] `bun lint` passes
- [ ] `bash examples/<name>/run-e2e.sh` (or `recipes/`) passes locally
- [ ] Folder, workflow matrix, package.json scripts, README all updated
- [ ] No stray `.alchemy/` or `.build/` artifacts committed
- [ ] No secrets, tokens, or absolute home paths in committed files

## Security issues

See [`SECURITY.md`](SECURITY.md). Don't open a public issue for
suspected vulnerabilities.
