'use agent';

import { type AgentProps, useModel } from '@flue/runtime';

export function AiGateway(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	return 'Answer each user request directly and concisely through the configured AI Gateway. Include the word gateway in every answer.';
}
