const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/checkpoint-${Date.now()}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'user', body: JSON.stringify({ message: 'checkpoint test' }) }) });
  if (response.status === 202 || response.status === 200) break;
  if (attempt === 14) throw new Error(`expected 202, got ${response.status}`);
  await sleep(4000);
}

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const response = await fetch(url);
  if (response.ok) {
    const snapshot = (await response.json()) as { messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> };
    const text = (snapshot.messages ?? []).filter((message) => message.role === 'assistant').flatMap((message) => message.parts ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n');
    const receipt = text.match(/https:\/\/[^\s"}]+\/results\/[^\s"}]+/)?.[0];
    if (receipt) {
      if (!(await fetch(`${receipt}.json`)).ok) throw new Error('checkpoint receipt did not resolve');
      console.log(`first checkpoint receipt: ${receipt}`);
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for first checkpoint');
