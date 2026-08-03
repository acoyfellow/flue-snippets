const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/probe-${Date.now()}`;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function admit(message: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ kind: 'user', body: message }),
    });
    if (response.status === 202) return;
    await sleep(4000);
  }
  throw new Error('agent did not admit the request with HTTP 202');
}

async function waitForAction(action: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': API_KEY } });
    if (response.ok) {
      const snapshot = JSON.stringify(await response.json()).replaceAll('\\', '');
      if (snapshot.includes(`"action":"${action}"`)) return;
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for the ${action} governor decision`);
}

await admit('same');
await waitForAction('continue');
await admit('same');
await waitForAction('continue');
await admit('same');
await waitForAction('reanchor');
await admit('same');
await waitForAction('ask-human');
console.log('✓ governor persisted state and escalated from continue to reanchor to ask-human');
