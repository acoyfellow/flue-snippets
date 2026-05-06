/**
 * test-helpers.ts — tiny test rig for invoking a Flue agent's default
 * export directly from a vitest test, without going through `flue dev`.
 *
 * The real Flue runtime supplies `init`, `payload`, `env` to the handler.
 * For E2E testing we synthesize the same shape. `init` returns an agent
 * whose `session()` returns an object with `prompt/skill/shell/task` that
 * call real model providers. For tests that don't want to burn LLM calls,
 * pass a stubbed `init` via the second arg.
 *
 * Goal: the test exercises the SNIPPET's logic + the real hosted services
 * the snippet calls (lab.coey.dev, deja.coey.dev, etc.). The model call
 * itself is the most expensive part; keep tests cheap by using small
 * models or stubbed prompts.
 */

import type {} from 'node:test';

export interface FluePayload {
  [key: string]: unknown;
}

export interface FlueEnvelope<P extends FluePayload = FluePayload> {
  payload: P;
  env: Record<string, string | undefined>;
}

export interface FakeAgent {
  session: (
    opts?: { system?: string; history?: unknown[] },
  ) => Promise<FakeSession>;
}

export interface FakeSession {
  prompt: (
    input: string,
    opts?: { result?: unknown; role?: string },
  ) => Promise<string | Record<string, unknown>>;
  skill: (
    name: string,
    opts?: { args?: unknown; result?: unknown; commands?: unknown[] },
  ) => Promise<unknown>;
  shell: (cmd: string, opts?: { cwd?: string }) => Promise<{ exit: number; stdout: string }>;
  task?: (input: string, opts?: { role?: string; cwd?: string }) => Promise<unknown>;
}

export interface FlueContext<P extends FluePayload = FluePayload> {
  init: (opts?: {
    model?: string;
    sandbox?: unknown;
    tools?: unknown;
    providers?: unknown;
    role?: string;
    cwd?: string;
  }) => Promise<FakeAgent>;
  payload: P;
  env: Record<string, string | undefined>;
}

export interface RunOptions<P extends FluePayload = FluePayload> {
  payload: P;
  env?: Record<string, string | undefined>;
  /** Override the default fake agent (e.g. to stub model responses). */
  init?: FlueContext<P>['init'];
}

/**
 * Default fake agent: returns a stub session whose `prompt` returns a
 * canned string mentioning the input (so snippets that pipe prompt output
 * into receipts have something to record). Override for real model calls
 * by passing a custom `init` to runFlueHandler.
 */
function makeStubAgent(model: string | undefined): FakeAgent {
  return {
    session: async () => ({
      prompt: async (input) => `[stub:${model ?? 'default'}] ${input.slice(0, 80)}`,
      skill: async (name, opts) => ({ skill: name, args: opts?.args, stub: true }),
      shell: async (cmd) => ({ exit: 0, stdout: `[stub-shell] ${cmd}` }),
      task: async (input) => ({ task: input, stub: true }),
    }),
  };
}

/**
 * Invoke a Flue agent's default-export handler with a synthetic context.
 * Returns whatever the handler returns.
 */
export async function runFlueHandler<P extends FluePayload, R>(
  handler: (ctx: FlueContext<P>) => Promise<R>,
  opts: RunOptions<P>,
): Promise<R> {
  const init: FlueContext<P>['init'] =
    opts.init ?? (async (initOpts) => makeStubAgent(initOpts?.model));

  const ctx: FlueContext<P> = {
    init,
    payload: opts.payload,
    env: { ...process.env, ...opts.env },
  };

  return await handler(ctx);
}

/**
 * Helper: call a real Flue init() if you want to exercise actual model
 * providers. For tests that don't want to burn API credits, leave
 * `runFlueHandler`'s default stub in place.
 */
export async function realInit(): Promise<FakeAgent> {
  // Placeholder for the real Flue init. When @flue/sdk/client exposes
  // a Node-importable init, swap this in. For now tests stay stubbed
  // for the LLM call; the OTHER hosted services (lab/deja) are still real.
  throw new Error(
    '@flue/sdk/client real init not wired here yet — pass a custom init() to runFlueHandler if you need real model calls.',
  );
}
