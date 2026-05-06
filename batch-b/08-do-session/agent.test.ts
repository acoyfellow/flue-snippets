/**
 * 08-do-session — E2E test
 *
 * What it proves:
 *  - the snippet's handler returns a string answer for a single prompt
 *  - the handler is shape-compatible with Flue's per-user-DO routing
 *    (the agent doesn't crash when called with the standard payload)
 *
 * Real DO persistence requires deploying the agent to Cloudflare Workers.
 * For local vitest we just exercise the handler logic; the per-user-DO
 * behavior is a runtime contract of `flue dev --target cloudflare`, not
 * something we can unit-test from Node alone.
 *
 * NOTE: this is the smallest snippet (12 LOC). If THIS test fails,
 * something is fundamentally wrong with our test harness or with how
 * @flue/sdk/client types work outside of `flue run`.
 */

import { describe, it, expect } from 'vitest';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

describe('08-do-session', () => {
  it('returns a string from a single prompt', async () => {
    const result = await runFlueHandler(handler, {
      payload: { message: 'hello' },
      env: {},
    });

    expect(typeof result).toBe('string');
    expect((result as string).length).toBeGreaterThan(0);
  });

  it('handles two consecutive calls without state errors', async () => {
    const first = await runFlueHandler(handler, {
      payload: { message: 'first message' },
    });
    const second = await runFlueHandler(handler, {
      payload: { message: 'second message' },
    });

    // Both calls should return strings; per-user DO state is a Cloudflare
    // runtime concern not testable from Node, but the handler shouldn't
    // throw or return undefined.
    expect(typeof first).toBe('string');
    expect(typeof second).toBe('string');
  });
});
