// Flue webhook forwarding to a Cloudflare Think DO for stateful chat.
// One Thinker DO per chatId (URL path segment). Docs:
// https://developers.cloudflare.com/agents/api-reference/think/

import { Think } from '@cloudflare/think';
import type { FlueContext } from '@flue/sdk/client';
import { createWorkersAI } from 'workers-ai-provider';

interface Env {
  AI: unknown;
  Thinker: DurableObjectNamespace;
}

export class Thinker extends Think<Env> {
  getModel() {
    const workersAi = createWorkersAI({
      binding: this.env.AI as Parameters<typeof createWorkersAI>[0]['binding'],
    });
    return workersAi('@cf/moonshotai/kimi-k2.6');
  }
}

// Think's chat() streams via a callback. We assemble text-delta chunks
// into a single string for the webhook response.
interface UIMessageChunk { type: string; delta?: string; text?: string }
interface StreamCallback {
  onEvent: (json: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}
interface ThinkerStub {
  chat: (userMessage: string, callback: StreamCallback) => Promise<void>;
}

export const triggers = { webhook: true };

// POST /agents/chat-thinking/<chatId>, same chatId hits the same DO.
export default async function ({ id, payload, env }: FlueContext & { env: Env }) {
  const chatId = id ?? 'default';
  const message = typeof payload.message === 'string' ? payload.message : 'Hello';

  const stub = env.Thinker.get(env.Thinker.idFromName(chatId)) as unknown as ThinkerStub;

  let text = '';
  let errored: string | undefined;
  await stub.chat(message, {
    onEvent: (json) => {
      try {
        const chunk = JSON.parse(json) as UIMessageChunk;
        if (chunk.type === 'text-delta') text += chunk.delta ?? chunk.text ?? '';
      } catch {
        // Non-JSON chunk, skip.
      }
    },
    onError: (msg) => { errored = msg; },
  });

  if (errored !== undefined) return { ok: false, error: errored };
  return { answer: text };
}
