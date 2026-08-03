'use agent';

import { defineTool, useDelivery, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

type IssueRequest = {
  issueTitle?: string;
  issueBody?: string;
  issueNumber?: number;
};

const triageSchema = v.object({
  severity: v.picklist(['low', 'medium', 'high', 'critical']),
  reproducible: v.boolean(),
  summary: v.string(),
});

const triageRubric = [
  'Classify an incoming GitHub issue.',
  'critical means data loss, security, or a production outage.',
  'high blocks a major user flow with no workaround.',
  'medium is a bug with a workaround or a major feature gap.',
  'low is cosmetic, a typo, or nice to have.',
  'Mark reproducible true only for clear reproduction steps.',
  'Write a one-sentence summary.',
].join('\n');

function requestFromBody(body: string): IssueRequest {
  try {
    return JSON.parse(body) as IssueRequest;
  } catch {
    return {};
  }
}

export function GithubTriage() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const delivery = useDelivery();
  const body = delivery.kind === 'user' ? delivery.body : '';

  useTool(
    defineTool({
      name: 'triage_github_issue',
      description: 'Classify the delivered GitHub issue into validated triage fields.',
      harness: true,
      async run({ harness }) {
        const issue = requestFromBody(body);
        const response = await harness.prompt(
          [
            triageRubric,
            '',
            `Title: ${issue.issueTitle ?? 'Untitled'}`,
            `Number: ${issue.issueNumber ?? 0}`,
            'Body:',
            issue.issueBody ?? '',
          ].join('\n'),
          { result: triageSchema },
        );
        return { output: { triage: response.data } };
      },
    }),
  );

  return 'Call triage_github_issue exactly once for every delivered issue. Return its output as JSON without changing field names.';
}
