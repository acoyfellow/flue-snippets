# triage

Classify an incoming GitHub issue.

## Args
- issueTitle: string, the issue title
- issueBody: string, the issue body markdown
- issueNumber: number, the issue number

## Steps
1. Read the title and body.
2. Decide severity:
   - critical: data loss, security, or production outage
   - high: blocks a major user flow with no workaround
   - medium: bug with workaround, or major feature gap
   - low: cosmetic, typo, or "nice to have"
3. Decide reproducible: true if the issue includes clear steps to reproduce.
4. Write a one-sentence summary.

Return the structured output exactly matching the schema.
