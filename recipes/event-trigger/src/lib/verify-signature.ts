// recipes/event-trigger/lib/verify-signature.ts
//
// A single, generic signing scheme so *any* upstream that can send a
// webhook (Sentry, PagerDuty, GitLab CI, a cron job, a shell one-liner)
// can authenticate the same way:
//
//   HMAC-SHA256(rawBody, sharedSecret)  →  "sha256=<hex>"
//
// This is the lowest common denominator the Flue thread landed on:
// "Sentry and PagerDuty should be easy, same with git actions using
// gitlab's CI to just send a webhook." They can all compute an HMAC
// over the JSON body and set one header. We verify it in constant time
// with Web Crypto (available in Workers).
//
// Services that sign with their *own* scheme (e.g. Sentry's
// `sentry-hook-signature`, GitLab's `X-Gitlab-Token`) can either be
// configured to send this HMAC header, or you add a per-source verifier
// alongside this one. The normalizer already knows the source, so
// branching the verification is a small, local change.

const encoder = new TextEncoder();

export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

export async function verifySignature(
  secret: string,
  body: string,
  signature: string,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const expected = await signBody(secret, body);
  return constantTimeEqual(expected, signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
