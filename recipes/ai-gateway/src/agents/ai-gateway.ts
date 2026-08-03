'use agent';

import { useModel } from '@flue/runtime';

export function AiGateway() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  return 'Answer the user concisely. This model call is routed through the configured Cloudflare AI Gateway.';
}
