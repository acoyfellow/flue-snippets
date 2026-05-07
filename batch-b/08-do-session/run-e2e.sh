#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for snippet 08 (do-session).
#
# Alchemy is the deploy backbone. Wrangler is not used directly.
#
# Required env:
#   CLOUDFLARE_API_TOKEN     — token with Workers Scripts:Edit + Workers AI:Read
#   CLOUDFLARE_ACCOUNT_ID    — personal account id
#
# Optional:
#   GITHUB_SHA               — used by alchemy.run.ts; defaults to "local"
#   STAGE                    — alchemy stage; defaults to "local"

set -euo pipefail
cd "$(dirname "$0")"

export STAGE="${STAGE:-local}"

cleanup() {
  local code=$?
  echo "::group::cleanup (alchemy destroy)"
  npx alchemy destroy --stage "$STAGE" 2>&1 || true
  echo "::endgroup::"
  exit $code
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf .build .alchemy
npx flue build --target cloudflare --workspace . --output .build
echo "::endgroup::"

echo "::group::alchemy deploy (stage=$STAGE)"
DEPLOY_LOG="$(mktemp)"
npx alchemy deploy --stage "$STAGE" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
if [ -z "$WORKER_URL" ]; then
  echo "::error::failed to capture deployed URL from alchemy output"
  exit 1
fi
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::wait for route propagation"
for i in $(seq 1 30); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' \
    "$WORKER_URL/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "route live (HTTP $code) after ${i}s"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "::error::worker still not responding after 30s"
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
