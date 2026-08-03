'use agent';

import { useModel } from '@flue/runtime';

export function ChatThinking() {
  useModel('cloudflare/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', { thinkingLevel: 'high' });
  return 'Reason carefully before answering. Give the user a concise final answer and retain useful conversational context for later turns.';
}
