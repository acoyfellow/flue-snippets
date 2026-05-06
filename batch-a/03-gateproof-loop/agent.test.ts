/**
 * 03-gateproof-loop — E2E test
 *
 * What it proves:
 *  - the snippet's handler runs without throwing
 *  - returns { ok: true } when a passing command (e.g. 'true') is the test
 *  - returns { ok: false, attempts: 3 } when a failing command ('false') is
 *
 * Real gateproof runs the command via Effect; we use unix `true`/`false`
 * to keep the test deterministic and fast.
 */

import { describe, it, expect } from 'bun:test';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

describe('03-gateproof-loop', () => {
  it('returns ok:true when the test command exits 0', async () => {
    const result = await runFlueHandler(handler, {
      payload: { task: 'no-op', testCommand: 'true' },
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.attempts).toBeLessThanOrEqual(3);
  });

  it('returns ok:false after 3 attempts when test command always fails', async () => {
    const result = await runFlueHandler(handler, {
      payload: { task: 'never passes', testCommand: 'false' },
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.reason).toBe('exceeded max attempts');
  });
});
