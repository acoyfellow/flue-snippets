// Triage a GitHub issue with Flue's skill() + valibot schema. The skill
// prompt lives in ./skills/triage.md. Structured output, so the LLM
// can't drift from the shape and downstream code can rely on it.

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

// POST /agents/github-triage/<id>  body: { issueBody, issueTitle?, issueNumber? }
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
