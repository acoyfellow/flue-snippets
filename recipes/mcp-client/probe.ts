/**
 * probe.ts — the real assertion for mcp-client.
 *
 * One POST to the Flue agent with a known input string. The agent is
 * supposed to call the co-hosted MCP server's `reverse_string` tool
 * and return the reversed value. We assert the response contains the
 * expected reversal.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/mcp-client)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const probeId = `mcp-${Date.now()}`;
const url = `${BASE}/${probeId}`;
const testText = 'octarine';
const expected = testText.split('').reverse().join(''); // 'eniratco'

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: testText }),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

// Flue wraps the agent's return value under `result`. The agent returns
// { text, reversed, mcpUrl }. `reversed` is whatever session.prompt()
// returned — empirically that's usually a string, but Flue/Workers AI
// sometimes return { text: string } depending on the model. Handle both.
const body = (await res.json()) as {
  result?: { text?: unknown; reversed?: unknown; mcpUrl?: unknown };
};

const reversed: unknown = body.result?.reversed;
let reversedStr = '';
if (typeof reversed === 'string') {
  reversedStr = reversed;
} else if (reversed && typeof reversed === 'object' && 'text' in reversed) {
  const t = (reversed as { text?: unknown }).text;
  reversedStr = typeof t === 'string' ? t : '';
}

console.log(`input:    ${testText}`);
console.log(`expected: ${expected}`);
console.log(`got:      ${reversedStr}`);

if (!reversedStr.toLowerCase().includes(expected.toLowerCase())) {
  console.error('MCP round-trip failed: response does not contain the reversed string');
  console.error(`full body: ${JSON.stringify(body)}`);
  process.exit(1);
}
console.log('✓ MCP tool call round-trip succeeded');
