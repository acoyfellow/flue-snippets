#!/usr/bin/env bash
#
# run-e2e.sh, full E2E for the github-app template.
#
# Deploys an ephemeral Worker, runs three signature-handling gates,
# then destroys the Worker. The probe creates its own valid signature
# using GITHUB_WEBHOOK_SECRET, which defaults to "dev-secret-rotate-me"
# (matching the alchemy default).

set -euo pipefail
cd "$(dirname "$0")"

export STAGE="${STAGE:-local}"
export GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-dev-secret-rotate-me}"

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
  echo "::error::failed to capture deployed URL"
  exit 1
fi
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
for i in $(seq 1 30); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$WORKER_URL/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "  /health live after ${i}s"; break; fi
  if [ "$i" = "30" ]; then echo "::error::/health not responding after 30s"; exit 1; fi
  sleep 1
done
# The webhook endpoint 401s without a signature, that's the desired
# behaviour. We can't do a "happy-path" warmup ping without computing a
# signature, so we trust /health and let the first gate (which expects
# a 401) double as the route-warmup.
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/agents/webhook" \
  GITHUB_WEBHOOK_SECRET="$GITHUB_WEBHOOK_SECRET" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ template github-app E2E pass"
