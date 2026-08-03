import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const plan = Plan.define({
  goals: [
    {
      id: 'governor-escalates-on-repeat',
      title: 'Repeated actions persist and escalate through the governor',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed agent mount URL')],
        act: [Act.exec(`AGENT_URL_BASE="${base}" bun run probe.ts`, { timeoutMs: 240_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 270_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
