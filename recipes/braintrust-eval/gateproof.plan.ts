import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');
const apiKey = process.env.SNIPPET_API_KEY ?? '';

const plan = Plan.define({
  goals: [
    {
      id: 'evaluation-target-is-live',
      title: 'The deployed Workers AI agent answers a prompt',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed agent mount URL')],
        act: [
          Act.exec(`AGENT_URL_BASE="${base}" SNIPPET_API_KEY="${apiKey}" bun run probe.ts`, {
            timeoutMs: 150_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'braintrust-runs-evaluation',
      title: 'Braintrust records an experiment over the deployed agent',
      gate: Gate.define({
        prerequisites: [
          Require.env('AGENT_URL_BASE', 'deployed agent mount URL'),
          Require.env('BRAINTRUST_API_KEY', 'experiment upload credential'),
        ],
        act: [
          Act.exec(
            `AGENT_URL_BASE="${base}" SNIPPET_API_KEY="${apiKey}" bunx braintrust eval eval.ts --no-progress-bars`,
            { timeoutMs: 300_000 },
          ),
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
