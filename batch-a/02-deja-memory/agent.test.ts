/**
 * 02-deja-memory — E2E test
 *
 * What it proves:
 *  - the snippet's handler returns { answer, memoryUsed }
 *  - deja.recall is callable via the published @acoyfellow/deja import
 *  - deja.remember persists the new exchange (verifiable on next call)
 *
 * Hits real deja.coey.dev (or env.DEJA_URL). Stubs the model call.
 */

import { describe, it, expect } from 'vitest';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

const DEJA_URL = process.env.DEJA_URL ?? 'https://deja.coey.dev';

describe('02-deja-memory', () => {
  it('returns { answer, memoryUsed: number }', async () => {
    const result = await runFlueHandler(handler, {
      payload: {
        question: 'What is the test discipline for flue-snippets?',
        topic: 'flue-snippets-test',
      },
      env: { DEJA_URL },
    });

    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('memoryUsed');
    expect(typeof result.answer).toBe('string');
    expect(typeof result.memoryUsed).toBe('number');
    expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
  });

  it('persists a new slip after the call (subsequent recall sees it)', async () => {
    const uniqueTopic = `flue-test-${Date.now()}`;
    const uniqueAnswer = `marker-${Math.random().toString(36).slice(2, 8)}`;

    // First call: should remember the marker.
    await runFlueHandler(handler, {
      payload: {
        question: `Remember this: ${uniqueAnswer}`,
        topic: uniqueTopic,
      },
      env: { DEJA_URL },
    });

    // Wait briefly for index propagation.
    await new Promise((r) => setTimeout(r, 1500));

    // Second call: recall should surface the prior exchange.
    const second = await runFlueHandler(handler, {
      payload: {
        question: `What did we say about ${uniqueAnswer}?`,
        topic: uniqueTopic,
      },
      env: { DEJA_URL },
    });

    // memoryUsed > 0 means deja.recall returned at least one slip.
    expect(second.memoryUsed).toBeGreaterThan(0);
  });
});
