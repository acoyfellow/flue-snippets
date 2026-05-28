// examples/effect-hello, the smallest Flue agent whose body is an Effect program.
//
// The trigger and response shape are pure Flue. The actual agent logic — the
// LLM call — runs inside `Effect.gen` and is executed with
// `Effect.runPromise`. That single `runPromise` is the only seam.
//
// What this proves: a Flue agent's body can be an Effect, with all the
// composition benefits that brings (typed errors, retries, timeouts,
// observability), without changing how Flue handles the HTTP boundary.

import type { FlueContext } from '@flue/sdk/client';
import { Effect } from 'effect';

interface Env {
  AI: { run: (model: string, args: unknown) => Promise<{ response: string }> };
}

export const triggers = { webhook: true };

// The agent — pure Effect. Inputs are plain values; output is a string.
const greet = (name: string, ai: Env['AI']) =>
  Effect.gen(function* () {
    const out = yield* Effect.tryPromise({
      try: () =>
        ai.run('@cf/moonshotai/kimi-k2.6', {
          prompt: `Greet ${name} in one short, friendly sentence. No preamble.`,
        }),
      catch: (e) => new Error(`Workers AI call failed: ${String(e)}`),
    });
    return out.response.trim();
  }).pipe(Effect.timeout('30 seconds'));

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const name = typeof payload.name === 'string' ? payload.name : 'world';
  const greeting = await Effect.runPromise(greet(name, env.AI));
  return { greeting };
}
