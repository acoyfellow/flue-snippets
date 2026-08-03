const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/mid-${Date.now()}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send(body: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'user', body }) });
    if (response.status === 202 || response.status === 200) return;
    if (attempt === 14) throw new Error(`expected 202, got ${response.status}`);
    await sleep(4000);
  }
}

await send(JSON.stringify({ message: 'first', every: 3 }));
await sleep(3000);
await send(JSON.stringify({ message: 'second', every: 3 }));

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const response = await fetch(url);
  if (response.ok) {
    const snapshot = (await response.json()) as { messages?: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> };
    const answers = (snapshot.messages ?? []).filter((message) => message.role === 'assistant').flatMap((message) => message.parts ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '');
    if (answers.length >= 2) {
      const latest = answers.at(-1) ?? '';
      if (/"cycle"\s*:\s*2/.test(latest) && !/https:\/\/[^\s"}]+\/results\//.test(latest)) {
        console.log('mid-cycle omitted a receipt');
        process.exit(0);
      }
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for mid-cycle response');
