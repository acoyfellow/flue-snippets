/**
 * gateproof plan for snippet 07 (r2-knowledge).
 *
 * One gate: send a customer question whose answer requires the agent to
 * grep the seeded refunds.md. The fixture contains the canary word
 * "octarine"; passing means the agent surfaced it (proving R2 → bash
 * read worked).
 *
 * Required env:
 *   AGENT_URL — full POST target
 */

import { Plan, Gate, Act, Assert, Require } from 'gateproof';
import { Effect } from 'effect';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

const probeScript = `
body=$(curl -fsS -X POST "${AGENT_URL}" -H 'content-type: application/json' \
  -d '{"message":"What hidden colour is mentioned in your knowledge base?"}')
echo "$body"
text=$(echo "$body" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{process.stdout.write(JSON.stringify(JSON.parse(s).result?.answer||{}))})")
case "$text" in
  *octarine*) echo "✓ agent found octarine in /workspace/refunds.md"; exit 0 ;;
  *)         echo "✗ expected 'octarine' in answer, got: $text" >&2; exit 1 ;;
esac
`;

const plan = Plan.define({
  goals: [
    {
      id: 'agent-greps-the-knowledge-base',
      title: 'Agent reads R2-mounted /workspace and surfaces a fact only present in the seeded file',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [Act.exec(probeScript, { timeoutMs: 90_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 120_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
