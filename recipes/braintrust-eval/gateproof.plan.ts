/** Gateproof plan for braintrust-eval. Required env: AGENT_URL, BRAINTRUST_API_KEY. */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const plan = Plan.define({
  goals: [
    {
      id: 'evaluation-target-is-live',
      title: 'The deployed Flue/Workers AI target answers a prompt',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [Act.exec(`AGENT_URL="${AGENT_URL}" bun run probe.ts`, { timeoutMs: 150_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'braintrust-runs-evaluation',
      title: 'Braintrust records an experiment over the deployed endpoint',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL', 'deployed snippet URL'),
          Require.env('BRAINTRUST_API_KEY', 'experiment upload credential'),
        ],
        act: [
          Act.exec(`AGENT_URL="${AGENT_URL}" bunx braintrust eval eval.ts --no-progress-bars`, {
            timeoutMs: 300_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 330_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
