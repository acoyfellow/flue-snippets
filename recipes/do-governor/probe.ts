/**
 * probe.ts — exercises the deployed do-governor agent five times in a
 * row, repeating the same `lastAction`, and asserts the governor
 * eventually escalates away from "continue".
 *
 * Used by gateproof.plan.ts via Act.exec — keeps complex JSON
 * threading out of bash heredocs (which can't deal with `\n`-laden
 * model responses cleanly).
 *
 * Required env:
 *   AGENT_URL — full POST target (e.g. https://...workers.dev/agents/do-governor/<id>)
 *
 * Exits 0 if escalation happened, non-zero otherwise.
 */

const URL = process.env.AGENT_URL;
if (!URL) {
  console.error('AGENT_URL is required');
  process.exit(2);
}

type GovResult = {
  result: {
    state: { cycle: number; recent: string[]; stuckScore: number };
    decision: {
      action: 'continue' | 'reanchor' | 'ask-human';
      instruction?: string;
      question?: string;
    };
  };
};

// Wait for the agent route to actually serve (propagation race after deploy).
async function call(state: unknown, lastAction: string) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'continue', lastAction, state }),
  });
  return res;
}

for (let i = 0; i < 30; i++) {
  const probe = await call({ cycle: 0, recent: [], stuckScore: 0 }, 'probe');
  if (probe.ok) {
    if (i > 0) console.log(`[wait] route live after ${i + 1} probes`);
    break;
  }
  if (i === 29) {
    console.error(`route still 404 after 30 probes: HTTP ${probe.status}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

let state: unknown = { cycle: 0, recent: [], stuckScore: 0 };
let last: GovResult | undefined;

for (let i = 0; i < 5; i++) {
  const res = await call(state, 'same');
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  last = (await res.json()) as GovResult;
  state = last.result.state;
  console.log(
    `[turn ${i + 1}] cycle=${last.result.state.cycle} stuckScore=${last.result.state.stuckScore} action=${last.result.decision.action}`,
  );
}

const finalAction = last!.result.decision.action;
if (finalAction === 'continue') {
  console.error(
    `expected governor to escalate after 5 repeats; final action still "continue". state: ${JSON.stringify(last!.result.state)}`,
  );
  process.exit(1);
}
console.log(`✓ governor escalated to "${finalAction}" after 5 repeats`);
