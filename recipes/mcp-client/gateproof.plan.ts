import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const agentUrlBase = process.env.AGENT_URL_BASE;
if (!agentUrlBase) throw new Error('AGENT_URL_BASE is required');

const plan = Plan.define({
  goals: [{
    id: 'mcp-reverse-string-round-trip',
    title: 'The agent calls the co-hosted MCP reverse-string tool',
    gate: Gate.define({
      prerequisites: [Require.env('AGENT_URL_BASE', 'deployed agent route')],
      act: [Act.exec(`AGENT_URL_BASE="${agentUrlBase}" bun run probe.ts`, { timeoutMs: 180_000 })],
      assert: [Assert.noErrors()],
      timeoutMs: 180_000,
    }),
  }],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
