'use agent';

import { useModel } from '@flue/runtime';

export function DoSession() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  return 'You are a concise chat assistant. Answer in one short sentence and use the conversation history to recall facts the user told you earlier.';
}
