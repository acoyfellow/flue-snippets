#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for snippet 01.
#
# Alchemy is the deploy backbone. Wrangler is not used directly anywhere
# in this repo. The flow:
#
# 1. `flue build --target cloudflare` produces `.build/dist/_entry.ts`
#    (the worker module + per-agent Durable Object class).
# 2. `alchemy deploy` reads alchemy.run.ts, declares the Worker + DO
#    binding + vars, bundles _entry.ts, and deploys.
# 3. The deployed URL is read from alchemy state.
# 4. We poll until the route is live (CF propagation race).
# 5. gateproof Plan runs against the URL.
# 6. `alchemy destroy` tears the worker + state down (always, on exit).
#
# No wrangler. No mocks. No skips. Real Workers AI, real Lab receipt.
#
# Required env:
#   CLOUDFLARE_API_TOKEN     — token with Workers Scripts:Edit + Workers AI:Read
#   CLOUDFLARE_ACCOUNT_ID    — personal account id
#
# Optional:
#   GITHUB_SHA               — used by alchemy.run.ts to suffix the worker
#                              name; defaults to "local"
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
# alchemy.run.ts prints the worker URL on stdout when up succeeds.
# We need the URL line specifically — alchemy also logs status banners.
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
AGENT_URL="${WORKER_URL}/agents/lab-receipt/test-${STAGE}" \
LAB_URL="${LAB_URL}" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet 01 E2E pass"
