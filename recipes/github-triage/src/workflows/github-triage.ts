import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/github-triage — triage a GitHub issue with Flue 1.0 structured
// output (valibot schema), so the LLM can't drift from the shape.
//
// The routing rubric is inlined (kept next to the code) and sent via
// session.prompt(text, { result: schema }); Flue parses the model response
// into validated response.data.

export const route: WorkflowRouteHandler = async (_c, next) => next();

const triageSchema = v.object({
  severity: v.picklist(['low', 'medium', 'high', 'critical']),
  reproducible: v.boolean(),
  summary: v.string(),
});

const TRIAGE_RUBRIC = [
  'Classify an incoming GitHub issue.',
  '',
  'Decide severity:',
  '  - critical: data loss, security, or production outage',
  '  - high: blocks a major user flow with no workaround',
  '  - medium: bug with workaround, or major feature gap',
  '  - low: cosmetic, typo, or "nice to have"',
  'Decide reproducible: true if the issue includes clear steps to reproduce.',
  'Write a one-sentence summary.',
].join('\n');

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({
    issueTitle: v.optional(v.string()),
    issueBody: v.optional(v.string()),
    issueNumber: v.optional(v.number()),
  }),
  output: v.object({ triage: triageSchema }),
  async run({ harness, input }) {
    const session = await harness.session();
    const { data } = await session.prompt(
      [
        TRIAGE_RUBRIC,
        '',
        'Issue:',
        `  title: ${input.issueTitle ?? 'Untitled'}`,
        `  number: ${input.issueNumber ?? 0}`,
        '  body:',
        input.issueBody ?? '',
      ].join('\n'),
      { result: triageSchema },
    );
    return { triage: data };
  },
});
