/**
 * probe.ts — the real assertion for github-triage.
 *
 * POST a synthetic issue payload at a unique id (so each run hits a
 * fresh DO). Assert the response carries a structured triage object
 * whose shape matches the valibot schema in the agent.
 *
 * The chosen fixture has obvious reproduction steps, so we can also
 * assert reproducible === true — that catches LLM drift on the
 * Boolean field even when the schema would otherwise accept either.
 *
 * Pure fetch + JSON. No bash heredocs, no python one-liners.
 *
 * Required env: AGENT_URL_BASE (e.g. https://...workers.dev/agents/github-triage)
 */

const BASE = process.env.AGENT_URL_BASE;
if (!BASE) {
  console.error('AGENT_URL_BASE is required');
  process.exit(2);
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type Severity = (typeof SEVERITIES)[number];

const url = `${BASE}/probe-${Date.now()}`;

const body = {
  issueTitle: 'App crashes when uploading large files',
  issueBody:
    '## Steps to reproduce\n1. Open the upload modal\n2. Pick any file > 100MB\n3. Click upload\n\n## Expected\nUpload completes\n\n## Actual\nApp crashes, browser tab freezes for 30s then shows blank page. Reproducible on Chrome 130 and Firefox 131 on macOS 15.',
  issueNumber: 42,
};

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`expected 200, got ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const json = (await res.json()) as {
  result?: {
    triage?: {
      severity?: unknown;
      reproducible?: unknown;
      summary?: unknown;
    };
  };
};

console.log(JSON.stringify(json));

const triage = json.result?.triage;
if (!triage || typeof triage !== 'object') {
  console.error('result.triage missing or not an object');
  process.exit(1);
}

const severity = triage.severity;
if (typeof severity !== 'string' || !SEVERITIES.includes(severity as Severity)) {
  console.error(`result.triage.severity invalid: ${JSON.stringify(severity)}`);
  process.exit(1);
}

const reproducible = triage.reproducible;
if (typeof reproducible !== 'boolean') {
  console.error(`result.triage.reproducible not a boolean: ${JSON.stringify(reproducible)}`);
  process.exit(1);
}
if (reproducible !== true) {
  console.error(
    'result.triage.reproducible === false, but fixture has clear repro steps — LLM drift',
  );
  process.exit(1);
}

const summary = triage.summary;
if (typeof summary !== 'string' || summary.length === 0) {
  console.error('result.triage.summary missing or empty');
  process.exit(1);
}

console.log(`✓ triage: severity=${severity} reproducible=${reproducible}`);
console.log(`✓ summary: ${summary}`);
