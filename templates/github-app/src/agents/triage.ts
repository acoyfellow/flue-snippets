import { type AgentRouteHandler, defineAgent } from '@flue/runtime';

// The agent the GitHub channel dispatches issue/PR events to. One instance per
// issue/PR (keyed by the channel's conversationKey). It triages the item and
// (with a real GITHUB_TOKEN) can comment back via the channel's Octokit tool.

export const description =
  'Triages GitHub issues and pull requests dispatched from the github channel.';

// Direct HTTP access is closed by default; events arrive via dispatch() from
// the verified channel, not this route.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
  instructions:
    'You triage GitHub issues and pull requests. Given the title and body, decide severity ' +
    '(low/medium/high/critical) and whether it is reproducible, and write a one-sentence summary. ' +
    'Keep responses concise.',
}));
