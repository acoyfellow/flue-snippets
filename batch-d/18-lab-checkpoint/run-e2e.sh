#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for snippet 18 (lab-checkpoint).
#
# 1. flue build → .build/dist/_entry.ts
# 2. alchemy deploy → declares Worker + DO + LAB_URL var
# 3. Poll for route propagation
# 4. gateproof Plan runs against the URL (3 gates)
# 5. alchemy destroy (always, on exit)
#
# Required env:
#   CLOUDFLARE_API_TOKEN     — Workers Scripts:Edit + Workers AI:Read
#   CLOUDFLARE_ACCOUNT_ID
#
# Optional:
#   GITHUB_SHA               — suffixes the worker name; defaults to "local"
#   STAGE                    — alchemy stage; defaults to "local"
#   LAB_URL                  — defaults to https://lab.coey.dev

set -euo pipefail
cd "$(dirname "$0")"

export STAGE="${STAGE:-local}"
export LAB_URL="${LAB_URL:-https://lab.coey.dev}"

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
AGENT_URL="${WORKER_URL}/agents/lab-checkpoint/test-${STAGE}" \
LAB_URL="${LAB_URL}" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet 18 E2E pass"
