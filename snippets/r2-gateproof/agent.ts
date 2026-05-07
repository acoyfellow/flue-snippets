// batch-c/13-r2-gateproof — Flue + Cloudflare Sandbox + gateproof
//
// An agent edits docs in a real Linux container (Cloudflare Sandbox via
// `getSandbox`), gateproof runs an exec-based plan to verify the docs
// still satisfy the contract (`bun run check:docs` exits 0). If the gate
// fails, the agent reads the failing message and revises.
//
// Per the canonical `flue add cloudflare` recipe:
//   - DO class ending in "Sandbox" auto-wires to @cloudflare/sandbox
//   - wrangler.jsonc declares the binding (see README)
//   - Dockerfile pinned to cloudflare/sandbox:0.9.2

import type { FlueContext } from '@flue/sdk/client';
import { getSandbox } from '@cloudflare/sandbox';
import { Plan, Gate, Act, Assert } from 'gateproof';
import { Effect } from 'effect';

export const triggers = { webhook: true };

interface Env {
  Sandbox: DurableObjectNamespace;
}

export default async function ({ init, id, payload, env }: FlueContext & { env: Env }) {
  const sandbox = getSandbox(env.Sandbox, id);
  const agent = await init({ sandbox, model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  const plan = Plan.define({
    goals: [
      {
        id: 'docs-pass',
        title: 'Doc gates pass',
        gate: Gate.define({
          act: [Act.exec('bun run check:docs')],
          assert: [Assert.noErrors()],
        }),
      },
    ],
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    await session.skill('edit-doc', { args: payload });

    const result = await Effect.runPromise(Plan.run(plan));
    if (result.status === 'pass') {
      return { ok: true, attempts: attempt, summary: result.summary };
    }

    const failure = result.goals.find((g) => g.status !== 'pass');
    await session.prompt(
      `Gate "${failure?.title}" failed: ${failure?.summary}. Revise the doc.`,
    );
  }

  return { ok: false, attempts: 3 };
}

declare type DurableObjectNamespace = unknown;
