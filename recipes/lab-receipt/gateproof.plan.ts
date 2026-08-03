import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const agentUrlBase = process.env.AGENT_URL_BASE;
if (!agentUrlBase) throw new Error('AGENT_URL_BASE is required');
const labUrl = process.env.LAB_URL ?? 'https://lab.coey.dev';

const plan = Plan.define({
  goals: [
    {
      id: 'agent-runs-and-emits-receipt',
      title: 'The prompt tool returns an answer and a Lab receipt',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed agent route')],
        act: [Act.exec(`AGENT_URL_BASE="${agentUrlBase}" bun run probe.ts`, { timeoutMs: 150_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'lab-origin-reachable',
      title: 'The Lab origin returns its catalog',
      gate: Gate.define({
        observe: { kind: 'http', url: `${labUrl}/lab/catalog`, pollInterval: 0 },
        assert: [Assert.httpResponse({ status: 200 }), Assert.responseBodyIncludes('"version"')],
        timeoutMs: 15_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
