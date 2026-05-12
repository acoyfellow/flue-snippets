// recipes/chat-thinking — Flue webhook agent + Cloudflare Think DO chat surface
//
// Flue handles the autonomous/headless work (webhook entry, structured
// return). Think (@cloudflare/think) handles the persistent stateful
// chat surface: tree-structured messages, context blocks, FTS5 search,
// non-destructive compaction — all backed by a SQLite-class Durable
// Object.
//
// The pattern: Flue is the orchestrator, Think is the chat agent. The
// Flue agent forwards each webhook POST to a per-chatId `Thinker` DO
// via the agent's RPC `chat()` method. Two POSTs to the same chatId
// land on the same DO, so Think remembers turn 1 in turn 2.
//
// Reference: https://developers.cloudflare.com/agents/api-reference/think/
//
// `Thinker` is co-located in this file (named export) so flue's build
// pipeline preserves it as a worker module export. alchemy.run.ts binds
// it as a SQLite-class DO namespace.

import { Think } from '@cloudflare/think';
import type { FlueContext } from '@flue/sdk/client';
import { createWorkersAI } from 'workers-ai-provider';

interface Env {
  AI: unknown;
  Thinker: DurableObjectNamespace;
}

// The Think subclass. Think is an abstract chat agent base class; the
// only thing every subclass must provide is `getModel()` — the AI SDK
// LanguageModel used for completions. Everything else (history,
// context, FTS5 search, compaction) is inherited.
export class Thinker extends Think<Env> {
  getModel() {
    const workersAi = createWorkersAI({
      binding: this.env.AI as Parameters<typeof createWorkersAI>[0]['binding'],
    });
    return workersAi('@cf/meta/llama-4-scout-17b-16e-instruct');
  }
}

export const triggers = { webhook: true };

// Think's `chat()` RPC signature (from the live docs):
//
//   async chat(
//     userMessage: string | UIMessage,
//     callback: StreamCallback,
//     options?: ChatOptions,
//   ): Promise<void>
//
// Streaming is delivered via the callback — `onEvent(json)` fires for
// each AI SDK UIMessageChunk (text-delta, tool-call, etc.); `onDone()`
// fires after the assistant message is persisted to the child's
// storage. There is no return payload; we assemble text-delta chunks
// into a string here.
interface UIMessageChunk {
  type: string;
  // text-delta chunks carry `delta` (AI SDK v5 shape).
  delta?: string;
  // Some emitters use `text` instead of `delta`. Cover both.
  text?: string;
}
interface StreamCallback {
  onEvent: (json: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}
interface ThinkerStub {
  chat: (userMessage: string, callback: StreamCallback) => Promise<void>;
}

// POST /agents/chat-thinking/<chatId>
//
// Flue routes by the path segment after the agent name. Same chatId =
// same Thinker DO = same conversation.
export default async function ({ id, payload, env }: FlueContext & { env: Env }) {
  const chatId = id ?? 'default';
  const message = typeof payload.message === 'string' ? payload.message : 'Hello';

  const stub = env.Thinker.get(env.Thinker.idFromName(chatId)) as unknown as ThinkerStub;

  let text = '';
  let errored: string | undefined;
  await stub.chat(message, {
    onEvent: (json: string) => {
      try {
        const chunk = JSON.parse(json) as UIMessageChunk;
        if (chunk.type === 'text-delta') {
          text += chunk.delta ?? chunk.text ?? '';
        }
      } catch {
        // Non-JSON chunks (shouldn't happen) — ignore.
      }
    },
    onDone: () => {
      // Message is now persisted to the Thinker DO's session storage.
    },
    onError: (msg: string) => {
      errored = msg;
    },
  });

  if (errored !== undefined) {
    return { ok: false, error: errored };
  }
  return { answer: text };
}
