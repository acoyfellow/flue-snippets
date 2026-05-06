// batch-a/03-gateproof-loop — Flue + gateproof
//
// A Flue agent that proves its work passes the gates before declaring
// victory. If gates fail, the agent reads the failure and retries.
// Self-healing, capped at 3 attempts.
//
// gateproof exposes a typed plan: Goal → Gate → { observe, act, assert }.
// Plan.run() returns an Effect; we tap it for the result.

import type { FlueContext } from '@flue/sdk/client';
import { Plan, Gate, Act, Assert } from 'gateproof';
import { Effect } from 'effect';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6', sandbox: 'local' });
  const session = await agent.session();

  // The plan: a single goal whose gate runs the test command and asserts
  // it exits successfully. The agent's job is to make this plan pass.
  const plan = Plan.define({
    goals: [
      {
        id: 'tests-pass',
        title: 'Test command exits 0',
        gate: Gate.define({
          act: [Act.exec(payload.testCommand ?? 'bun test')],
          assert: [Assert.noErrors()],
        }),
      },
    ],
    loop: { maxIterations: 1, stopOnFailure: true },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    await session.prompt(`Attempt ${attempt}: ${payload.task}`);

    const result = await Effect.runPromise(Plan.run(plan));
    if (result.status === 'pass') {
      return { ok: true, attempts: attempt, summary: result.summary };
    }

    // Feed the failure back to the agent for the next attempt.
    const failure = result.goals.find((g) => g.status !== 'pass');
    await session.prompt(
      `Gate "${failure?.title}" failed: ${failure?.summary}. ` +
      `Errors: ${failure?.evidence.errors.join(', ')}. Adjust your approach.`,
    );
  }

  return { ok: false, attempts: 3, reason: 'exceeded max attempts' };
}
