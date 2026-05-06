/**
 * 01-lab-receipt — E2E test
 *
 * What it proves:
 *  - the snippet's handler returns { answer, receipt }
 *  - the receipt URL is well-formed (lab origin + /results/:id)
 *  - the receipt URL resolves to JSON with outcome.ok = true
 *  - the receipt JSON records source="flue", action="prompt"
 *
 * Hits real lab.coey.dev (or env.LAB_URL). Stubs the model call.
 */

import { describe, it, expect } from 'vitest';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';

describe('01-lab-receipt', () => {
  it('returns { answer, receipt } with a well-formed receipt URL', async () => {
    const result = await runFlueHandler(handler, {
      payload: { message: 'hello from the test' },
      env: { LAB_URL },
    });

    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('receipt');
    expect(typeof result.answer).toBe('string');
    expect(result.receipt).toMatch(
      new RegExp(`^${LAB_URL.replace(/\//g, '\\/')}\\/results\\/[a-z0-9]+$`),
    );
  });

  it('the receipt URL resolves to JSON with outcome.ok = true', async () => {
    const result = await runFlueHandler(handler, {
      payload: { message: 'verify the receipt round-trip' },
      env: { LAB_URL },
    });

    const receiptResponse = await fetch(`${result.receipt}.json`);
    expect(receiptResponse.ok).toBe(true);
    const receipt = await receiptResponse.json();

    expect(receipt.outcome.ok).toBe(true);
    expect(receipt.receipt?.source ?? receipt.request?.source).toBe('flue');
    expect(receipt.receipt?.action ?? receipt.request?.action).toBe('prompt');
  });
});
