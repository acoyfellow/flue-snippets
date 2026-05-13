// recipes/github-triage — the canonical Flue demo
//
// Triages a GitHub issue payload. Returns structured triage (severity,
// reproducible, summary) using Flue's skill() with a valibot schema —
// the LLM can't drift from the shape, so downstream code can rely on it.
//
// In production this would be wired to a real GitHub webhook + GH App
// token, and would post the triage back as an issue comment. For the
// snippet, we accept the issue body inline so the E2E doesn't require
// a live repo or a Personal Access Token.
//
// TODO: confirm session.skill() signature against the live docs at
//       https://flueframework.com — the skill prompt lives in
//       ./skills/triage.md.

import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';

export const triggers = { webhook: true };

interface TriagePayload {
  issueTitle?: unknown;
  issueBody?: unknown;
  issueNumber?: unknown;
}

const triageSchema = v.object({
  severity: v.picklist(['low', 'medium', 'high', 'critical']),
  reproducible: v.boolean(),
  summary: v.string(),
});

// POST /agents/github-triage/<id>
// Body: { issueBody: string, issueTitle?: string, issueNumber?: number }
export default async function ({ init, payload }: FlueContext) {
  const p = payload as TriagePayload;

  const agent = await init({
    model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
  });
  const session = await agent.session();

  const { data } = await session.skill('triage', {
    args: {
      issueTitle: typeof p.issueTitle === 'string' ? p.issueTitle : 'Untitled',
      issueBody: typeof p.issueBody === 'string' ? p.issueBody : '',
      issueNumber: typeof p.issueNumber === 'number' ? p.issueNumber : 0,
    },
    schema: triageSchema,
  });

  return { triage: data };
}
