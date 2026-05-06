/**
 * 03-gateproof-loop — E2E test
 *
 * What it proves:
 *  - the snippet's handler runs without throwing for a successful gate
 *  - returns { ok: true, attempts, proof: URL } when the plan passes
 *  - returns { ok: false, attempts: 3 } when the plan keeps failing
 *
 * gateproof imports from @acoyfellow/gateproof; the test supplies a
 * minimal in-memory plan factory so we don't need a real workspace.
 */

import { describe, it, expect } from 'vitest';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

describe('03-gateproof-loop', () => {
  it('returns ok:true when the plan succeeds', async () => {
    const result = await runFlueHandler(handler, {
      payload: {
        task: 'no-op task that always passes',
        plan: 'fixtures/passing-plan.ts',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.attempts).toBeLessThanOrEqual(3);
    expect(result).toHaveProperty('proof');
  });

  it('returns ok:false after 3 attempts when the plan never passes', async () => {
    const result = await runFlueHandler(handler, {
      payload: {
        task: 'task that never passes the gate',
        plan: 'fixtures/failing-plan.ts',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.reason).toBe('exceeded max attempts');
  });
});
