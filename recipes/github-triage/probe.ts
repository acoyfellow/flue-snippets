const API_KEY = process.env.SNIPPET_API_KEY ?? '';
const base = process.env.AGENT_URL_BASE;
if (!base) throw new Error('AGENT_URL_BASE is required');

const url = `${base}/issue-${Date.now()}`;
const body = JSON.stringify({
  issueTitle: 'App crashes when uploading large files',
  issueBody: 'Steps to reproduce: open upload, choose a file above 100MB, then click upload. The browser freezes and crashes.',
  issueNumber: 42,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 0; attempt < 15; attempt += 1) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify({ kind: 'user', body }) });
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
    if (/(low|medium|high|critical)/.test(text) && /true|false/.test(text) && text.length > 20) {
      console.log(`triage response: ${text}`);
      process.exit(0);
    }
  }
  await sleep(2000);
}
throw new Error('timed out waiting for triage');
