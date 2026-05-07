#!/usr/bin/env bash
#
# run-e2e.sh — full E2E for snippet 07 (r2-knowledge).
#
# 1. flue build → .build/dist/_entry.ts
# 2. alchemy deploy: creates R2 bucket, seeds it with refunds.md, deploys worker
# 3. Poll for route propagation
# 4. gateproof Plan asks a question whose answer is only in the seeded file
# 5. alchemy destroy (always, on exit) — tears down the bucket too

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
    echo "health live after ${i}s"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "::error::worker /health not responding after 30s"
    exit 1
  fi
  sleep 1
done
for i in $(seq 1 12); do
  code=$(curl -sS -m 60 -o /dev/null -w '%{http_code}' -X POST \
    "$WORKER_URL/agents/r2-knowledge/warmup" \
    -H 'content-type: application/json' \
    -d '{"message":"warmup"}' 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "agent route live after $i attempts"
    break
  fi
  if [ "$i" = "12" ]; then
    echo "::error::agent route still failing (HTTP $code)"
    exit 1
  fi
  sleep 5
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL="${WORKER_URL}/agents/r2-knowledge/test-${STAGE}" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet 07 E2E pass"
