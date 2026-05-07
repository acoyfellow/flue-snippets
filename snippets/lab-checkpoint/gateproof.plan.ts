/**
 * gateproof plan for snippet 18 (lab-checkpoint).
 *
 * Three gates:
 *   1. First call (cycle=1) checkpoints — response has a `receipt` URL.
 *   2. Mid-cycle call (cycle=2) does NOT checkpoint — no receipt field.
 *   3. The Lab origin actually returns the receipt JSON for the URL we
 *      got in gate 1 (proves the receipt was really persisted).
 *
 * Required env:
 *   AGENT_URL — deployed worker base + /agents/lab-checkpoint/<id>
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

// First call: cycle starts at 0, becomes 1, should checkpoint.
const firstCallScript = `
body=$(curl -fsS -X POST "${AGENT_URL}" -H 'content-type: application/json' \
  -d '{"message":"checkpoint test"}')
echo "$body"
# Extract receipt URL and probe it. If receipt is missing or lab returns
# anything but 200, fail the gate.
receipt=$(echo "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin)["result"]; print(d.get("receipt",""))')
if [ -z "$receipt" ]; then
  echo "first call did not return a receipt URL" >&2
  exit 1
fi
status=$(curl -sS -o /dev/null -w '%{http_code}' "$receipt.json")
if [ "$status" != "200" ]; then
  echo "lab did not serve the receipt (got HTTP $status from $receipt.json)" >&2
  exit 1
fi
`;

const plan = Plan.define({
  goals: [
    {
      id: 'first-call-checkpoints',
      title: 'First call returns a receipt URL and lab serves it back',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL', 'deployed snippet URL')],
        act: [Act.exec(firstCallScript, { timeoutMs: 150_000 })],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
    {
      id: 'mid-cycle-skips',
      title: 'Mid-cycle call (cycle=1 with every=3) does NOT checkpoint',
      gate: Gate.define({
        act: [
          Act.exec(`AGENT_URL="${AGENT_URL}" bun run probe-mid.ts`, {
            timeoutMs: 120_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 150_000,
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
