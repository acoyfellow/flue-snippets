/**
 * gateproof plan for mcp-client.
 *
 * One gate: probe.ts POSTs a known string to the Flue agent and asserts
 * the agent's response contains the reversed string, proving the model
 * actually called the co-hosted MCP server's `reverse_string` tool and
 * returned its output.
 *
 * Required env: AGENT_URL_BASE
 */

import { Effect } from 'effect';
import { Act, Assert, Gate, Plan, Require } from 'gateproof';

const AGENT_URL_BASE = process.env.AGENT_URL_BASE;
if (!AGENT_URL_BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const plan = Plan.define({
  goals: [
    {
      id: 'mcp-reverse-string-round-trip',
      title: 'Flue agent calls a co-hosted MCP server tool and returns the reversed string',
      gate: Gate.define({
        prerequisites: [Require.env('AGENT_URL_BASE', 'deployed worker URL + /agents/mcp-client')],
        act: [
          Act.exec(`AGENT_URL_BASE="${AGENT_URL_BASE}" bun run probe.ts`, {
            timeoutMs: 180_000,
          }),
        ],
        assert: [Assert.noErrors()],
        timeoutMs: 180_000,
      }),
    },
  ],
});

const result = await Effect.runPromise(Plan.run(plan));

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
