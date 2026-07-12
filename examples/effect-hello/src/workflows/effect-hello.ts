import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import { Effect } from 'effect';
import * as v from 'valibot';

// examples/effect-hello — the smallest Flue 1.0 workflow whose body is an
// Effect program. The LLM call runs inside Effect.gen and is executed with
// Effect.runPromise; that single runPromise is the only seam. What this
// proves: a Flue workflow's body can be an Effect (typed errors, timeouts,
// retries, observability) without changing the HTTP boundary.
//
// The model call goes through Flue's session.prompt(...) (the idiomatic 1.0
// surface) rather than the raw env.AI.run binding, so the provider/response
// shape is owned by Flue and stays portable across targets.

interface Session {
  prompt: (text: string) => Promise<{ text: string }>;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const greet = (name: string, session: Session) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => session.prompt(`Greet ${name} in one short, friendly sentence. No preamble.`),
      catch: (e) => new Error(`prompt failed: ${String(e)}`),
    });
    return response.text.trim();
  }).pipe(Effect.timeout('30 seconds'));

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ name: v.optional(v.string()) }),
  output: v.object({ greeting: v.string() }),
  async run({ harness, input }) {
    const session = (await harness.session()) as unknown as Session;
    const greeting = await Effect.runPromise(greet(input.name ?? 'world', session));
    return { greeting };
  },
});
