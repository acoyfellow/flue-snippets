'use agent';

import { useModel } from '@flue/runtime';

export function BraintrustEval() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  return 'Follow the user request exactly and answer concisely.';
}
