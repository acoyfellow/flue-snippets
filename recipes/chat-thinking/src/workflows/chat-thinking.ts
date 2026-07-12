import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/chat-thinking — Flue 1.0 workflow forwarding a chat turn to a
// per-chatId Cloudflare Think Durable Object (stateful chat in SQLite).
// Think's chat() streams via a callback; we assemble text-delta chunks into
// one string. Same chatId = same Think DO = same history.
// Docs: https://developers.cloudflare.com/agents/api-reference/think/

interface UIMessageChunk {
  type: string;
  delta?: string;
  text?: string;
}
// Think's chat() callback is an RpcTarget requiring all four methods
// (onStart → onEvent* → onDone | onError).
interface StreamCallback {
  onStart: (event: unknown) => void;
  onEvent: (json: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}
interface ThinkerStub {
  chat: (userMessage: string, callback: StreamCallback) => Promise<void>;
}
interface Env {
  Thinker: DurableObjectNamespace;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ chatId: v.string(), message: v.string() }),
  output: v.object({
    ok: v.boolean(),
    answer: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  async run({ input }) {
    const { Thinker } = env as unknown as Env;
    const stub = Thinker.get(Thinker.idFromName(input.chatId)) as unknown as ThinkerStub;
    let text = '';
    let errored: string | undefined;
    await stub.chat(input.message, {
      onStart: () => {},
      onEvent: (json) => {
        try {
          const chunk = JSON.parse(json) as UIMessageChunk;
          if (chunk.type === 'text-delta') text += chunk.delta ?? chunk.text ?? '';
        } catch {
          // non-JSON chunk, skip
        }
      },
      onDone: () => {},
      onError: (msg) => {
        errored = msg;
      },
    });
    if (errored !== undefined) return { ok: false, error: errored };
    return { ok: true, answer: text };
  },
});
