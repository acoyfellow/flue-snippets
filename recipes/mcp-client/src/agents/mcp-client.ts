'use agent';

import { env } from 'cloudflare:workers';
import { defineMcpConnection, useMcpConnection, useModel } from '@flue/runtime';

type RuntimeEnv = { MCP_URL: string };

export function McpClient() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const runtime = env as unknown as RuntimeEnv;
  useMcpConnection(
    defineMcpConnection({
      name: 'reverser',
      url: runtime.MCP_URL,
      tools: ['reverse_string'],
    }),
  );
  return 'Use the reverse_string MCP tool exactly once to reverse the text in the delivered JSON request. Return only the reversed string.';
}
