/**
 * gateproof plan for snippet 11 (gateway-lab).
 *
 * Two gates:
 *   1. POST through the deployed worker → returns 200 with a real
 *      answer + a receipt URL on lab.coey.dev.
 *   2. The Lab origin really did persist the receipt — fetching the
 *      `.json` view returns 200.
 *
 * Required env:
 *   AGENT_URL — full POST target
 *   LAB_URL   — Lab origin (defaults https://lab.coey.dev)
 */

import { Plan, Gate, Act, Assert, Require } from 'gateproof';
import { Effect } from 'effect';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}
const LAB_URL = process.env.LAB_URL ?? 'https://lab.coey.dev';

const probeScript = `
body=$(curl -fsS -X POST "${AGENT_URL}" -H 'content-type: application/json' \
  -d '{"message":"hi from gateproof, gateway+lab"}')
echo "$body"
receipt=$(echo "$body" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const r=JSON.parse(s).result?.receipt;process.stdout.write(r||'')})")
if [ -z "$receipt" ]; then echo "no receipt URL in response" >&2; exit 1; fi
status=$(curl -sS -o /dev/null -w '%{http_code}' "$receipt.json")
if [ "$status" != "200" ]; then echo "lab did not serve receipt (HTTP $status)" >&2; exit 1; fi
`;

const plan = Plan.define({
  goals: [
    {
      id: 'gateway-and-lab-both-record',
      title: 'Worker routes through AI Gateway, gets a model answer, and persists a Lab receipt',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [Act.exec(probeScript, { timeoutMs: 150_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 120_000,
      }),
    },
    {
      id: 'lab-origin-reachable',
      title: 'The Lab origin returns its catalog',
      gate: Gate.define({
        observe: { kind: 'http', url: `${LAB_URL}/lab/catalog`, pollInterval: 0 },
        assert: [
          Assert.httpResponse({ status: 200 }),
          Assert.responseBodyIncludes('"version"'),
        ],
        timeoutMs: 10_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
