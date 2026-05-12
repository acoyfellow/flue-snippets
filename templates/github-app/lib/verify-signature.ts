// templates/github-app/lib/verify-signature.ts
//
// GitHub signs webhook deliveries with HMAC-SHA256 of the raw body
// using the webhook secret. The signature is sent as:
//   X-Hub-Signature-256: sha256=<hex>
//
// This helper does a constant-time compare against the expected value
// using Web Crypto (available in Workers).

const encoder = new TextEncoder();

export async function verifySignature(
  secret: string,
  body: string,
  signature: string,
): Promise<boolean> {
  if (!secret || !signature) return false;

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
  const expected = `sha256=${hex}`;

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
