/**
 * 02-deja-memory — E2E test
 *
 * What it proves:
 *  - the snippet handler returns { answer, memoryUsed }
 *  - deja's recall() runs without throwing on a fresh DB
 *  - deja's remember() persists across calls when given a shared path
 *
 * Deja is LOCAL: each test gets a tempfile DB so writes survive within
 * the test. :memory: would isolate every Deja instance.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import handler from './agent.ts';
import { runFlueHandler } from '../../test-helpers.ts';

const TEST_DB = join(tmpdir(), `deja-test-${Date.now()}.db`);

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe('02-deja-memory', () => {
  it('returns { answer, memoryUsed: number } on a fresh DB', async () => {
    const result = await runFlueHandler(handler, {
      payload: { question: 'first question on fresh db', topic: 'test' },
      env: { DEJA_PATH: TEST_DB },
    });

    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('memoryUsed');
    expect(typeof result.answer).toBe('string');
    expect(result.memoryUsed).toBe(0); // fresh DB, no memory yet
  });

  it('recalls memory persisted by a previous call (same DB path)', async () => {
    const sharedDb = join(tmpdir(), `deja-shared-${Date.now()}.db`);

    // First call writes something memorable.
    await runFlueHandler(handler, {
      payload: { question: 'what is the launch date for project nova', topic: 'shared' },
      env: { DEJA_PATH: sharedDb },
    });

    // Second call asks a related question; should recall something.
    const second = await runFlueHandler(handler, {
      payload: { question: 'project nova launch', topic: 'shared' },
      env: { DEJA_PATH: sharedDb },
    });

    expect(second.memoryUsed).toBeGreaterThan(0);
    if (existsSync(sharedDb)) unlinkSync(sharedDb);
  });
});
