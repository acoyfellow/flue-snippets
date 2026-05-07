#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for snippet 08 (do-session).
#
# 1. Build the Flue agent for Cloudflare target (DO sessions wired by SDK).
# 2. Deploy to a unique Worker name on the personal CF account.
# 3. Poll for route propagation.
# 4. Run the gateproof plan against the deployed URL (two turns, same DO).
# 5. Tear down the Worker (always, even on failure).
#
# No mocks. No skips. The agent calls Workers AI through a Flue session
# that lives in a Durable Object. Cost ≈ $0.0002 per run (2 prompts).
#
# Required env:
#   CLOUDFLARE_API_TOKEN     — token with Workers Scripts:Edit + Workers AI
#   CLOUDFLARE_ACCOUNT_ID    — personal account
#
# Optional:
#   GITHUB_SHA               — used in the worker name; defaults to local-<rand>

set -euo pipefail
cd "$(dirname "$0")"

SHA="${GITHUB_SHA:-local}-$(openssl rand -hex 3)"
SHA="${SHA:0:14}"
export WORKER_NAME="flue-08-do-session-${SHA}"

cleanup() {
  local code=$?
  echo "::group::cleanup"
  npx wrangler delete --name "$WORKER_NAME" --force 2>&1 || true
  echo "::endgroup::"
  exit $code
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf .build
npx flue build --target cloudflare --workspace . --output .build
node -e "
  const fs = require('fs');
  const p = '.build/dist/wrangler.jsonc';
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  c.name = process.env.WORKER_NAME;
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
" || { echo "::error::failed to patch wrangler.jsonc"; exit 1; }
rm -rf .build/.wrangler
echo "patched name to: $WORKER_NAME"
echo "::endgroup::"

echo "::group::wrangler deploy ($WORKER_NAME)"
cd .build/dist
npx wrangler deploy \
  --name "$WORKER_NAME" \
  --var "CLOUDFLARE_ACCOUNT_ID:${CLOUDFLARE_ACCOUNT_ID}" \
  --var "CLOUDFLARE_API_KEY:${CLOUDFLARE_API_TOKEN}" \
  2>&1 | tee /tmp/wrangler-deploy.log

WORKER_URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' /tmp/wrangler-deploy.log | head -1)
if [ -z "$WORKER_URL" ]; then
  echo "::error::failed to capture deployed URL"
  exit 1
fi
cd ../..
echo "deployed: $WORKER_URL"

echo "waiting for route propagation…"
for i in $(seq 1 30); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
    "${WORKER_URL}/agents/do-session/probe" \
    -H 'content-type: application/json' \
    -d '{"message":"probe"}' || echo "000")
  if [ "$code" != "404" ] && [ "$code" != "000" ]; then
    echo "route live (HTTP $code) after ${i}s"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "::error::worker still 404'ing after 30s — deploy is broken, not just propagating"
    exit 1
  fi
  sleep 1
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/agents/do-session" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet 08 E2E pass"
