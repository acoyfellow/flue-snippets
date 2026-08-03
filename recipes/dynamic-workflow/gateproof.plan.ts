import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const agentUrlBase = process.env.AGENT_URL_BASE;
if (!agentUrlBase) throw new Error('AGENT_URL_BASE is required');

const plan = Plan.define({
  goals: [{
    id: 'dynamic-task-orchestration-in-order',
    title: 'One durable agent instance retains runtime-selected task results in order',
    gate: Gate.define({
      prerequisites: [Require.env('AGENT_URL_BASE', 'deployed worker URL + agent route')],
      act: [Act.exec(`AGENT_URL_BASE="${agentUrlBase}" bun run probe.ts`, { timeoutMs: 180_000 })],
      assert: [Assert.noErrors()],
      timeoutMs: 200_000,
    }),
  }],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
