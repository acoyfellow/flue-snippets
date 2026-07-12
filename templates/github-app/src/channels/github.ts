import { createGitHubChannel } from '@flue/github';
import { dispatch } from '@flue/runtime';
import triage from '../agents/triage.ts';

// GitHub App webhook ingress at POST /channels/github/webhook. @flue/github
// verifies the x-hub-signature-256 HMAC against the raw body (real 401 on
// bad/missing signature), parses the typed delivery, and calls this handler.
// We dispatch issue/PR opens to the triage agent (fire-and-forget); GitHub
// gets a fast 2xx.

export const channel = createGitHubChannel({
  webhookSecret: requiredEnv('GITHUB_WEBHOOK_SECRET'),

  async webhook({ delivery }) {
    if (
      delivery.name === 'issues' &&
      delivery.payload.action === 'opened' &&
      delivery.payload.issue
    ) {
      const { repository, issue } = delivery.payload;
      const ref = {
        owner: repository.owner.login,
        repo: repository.name,
        issueNumber: issue.number,
      };
      await dispatch(triage, {
        id: channel.conversationKey(ref),
        input: {
          type: 'github.issues.opened',
          title: issue.title,
          body: issue.body ?? '',
          deliveryId: delivery.deliveryId,
          owner: ref.owner,
          repo: ref.repo,
          issueNumber: ref.issueNumber,
        },
      });
      return { handled: 'issues.opened', issue: issue.number };
    }
    if (
      delivery.name === 'pull_request' &&
      delivery.payload.action === 'opened' &&
      delivery.payload.pull_request
    ) {
      const { repository, pull_request } = delivery.payload;
      const ref = {
        owner: repository.owner.login,
        repo: repository.name,
        issueNumber: pull_request.number,
      };
      await dispatch(triage, {
        id: channel.conversationKey(ref),
        input: {
          type: 'github.pull_request.opened',
          title: pull_request.title,
          body: pull_request.body ?? '',
          deliveryId: delivery.deliveryId,
          owner: ref.owner,
          repo: ref.repo,
          prNumber: ref.issueNumber,
        },
      });
      return { handled: 'pull_request.opened', pr: pull_request.number };
    }
    return {
      handled: 'ignored',
      event: delivery.name,
      action: (delivery.payload as { action?: string }).action ?? null,
    };
  },
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
