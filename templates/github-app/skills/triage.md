# triage

Classify an incoming GitHub issue.

## Args
- `issueTitle: string`, the issue title
- `issueBody: string`, the issue body markdown
- `issueNumber: number`, the issue number

## Steps
1. Read the title and body.
2. Decide severity:
   - **critical**, data loss, security incident, or production outage
   - **high**, blocks a major user flow with no workaround
   - **medium**, bug with workaround, or major feature gap
   - **low**, cosmetic, typo, "nice to have"
3. Decide `reproducible`: `true` if the issue includes clear steps to
   reproduce, observed behaviour, AND expected behaviour. Otherwise `false`.
4. Write a one-sentence summary suitable for a triage comment.

Return the structured output exactly matching the schema. No prose
outside the schema fields.
