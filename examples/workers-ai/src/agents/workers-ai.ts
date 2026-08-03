'use agent';

import { type AgentProps, useModel } from '@flue/runtime';

export function WorkersAi(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	return 'Answer each user request directly and concisely.';
}
