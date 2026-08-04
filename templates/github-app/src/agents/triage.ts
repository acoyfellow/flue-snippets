'use agent';

// The agent the GitHub channel dispatches issue/PR events to. One instance per
// issue/PR (keyed by the channel's conversationKey). It triages the item and
// (with a real GITHUB_TOKEN) can comment back via the channel's Octokit tool.
//
// Flue 2: the agent IS this function. `instructions` is now the returned
// string, and `export const route` is gone, so direct HTTP access is closed by
// simply not mounting this agent in src/app.ts. Registration comes from the
// 'use agent' scan, so dispatch() still reaches it while it stays unmounted.

import { useModel } from '@flue/runtime';

export function Triage() {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	return (
		'You triage GitHub issues and pull requests. Given the title and body, decide severity ' +
		'(low/medium/high/critical) and whether it is reproducible, and write a one-sentence summary. ' +
		'Keep responses concise.'
	);
}
