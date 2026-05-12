# pr-review

Skim a pull request description and flag risk.

## Args
- `prTitle: string` — the PR title
- `prBody: string` — the PR body markdown
- `prNumber: number` — the PR number

## Steps
1. Read the title and body.
2. Decide `risk`:
   - **high** — touches auth, payments, migrations, infra, or has no test plan
   - **medium** — non-trivial logic change, partial test coverage
   - **low** — docs, formatting, comments, trivial refactor
3. Write a one-sentence summary of what the PR does.
4. Suggest up to three reviewer usernames based on the PR scope.
   If you don't have enough signal, return an empty array.

Return only the structured output matching the schema.
