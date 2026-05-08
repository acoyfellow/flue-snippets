#!/usr/bin/env bash
#
# run-e2e.sh — workers-ai hello world.
# Build → deploy → warmup → POST + grep → destroy.

set -euo pipefail
cd "$(dirname "$0")"

export STAGE="${STAGE:-local}"
AGENT="workers-ai"

cleanup() {
  local code=$?
  echo "::group::cleanup"
  npx alchemy destroy --stage "$STAGE" 2>&1 || true
  echo "::endgroup::"
  exit $code
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf .build .alchemy
npx flue build --target cloudflare --workspace . --output .build
echo "::endgroup::"

echo "::group::alchemy deploy"
DEPLOY_LOG="$(mktemp)"
npx alchemy deploy --stage "$STAGE" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
[ -z "$WORKER_URL" ] && { echo "::error::no URL"; exit 1; }
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
for i in $(seq 1 30); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$WORKER_URL/health" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && { echo "/health live (${i}s)"; break; }
  [ "$i" = "30" ] && { echo "::error::/health failing"; exit 1; }
  sleep 1
done
for i in $(seq 1 12); do
  code=$(curl -sS -m 120 -o /tmp/wu -w '%{http_code}' -X POST \
    "$WORKER_URL/agents/$AGENT/warmup" -H 'content-type: application/json' \
    -d '{"message":"warmup"}' 2>/dev/null || echo 000)
  [ "$code" = "200" ] && { echo "agent route live ($i)"; break; }
  [ "$i" = "12" ] && { echo "::error::agent route failing (HTTP $code)"; cat /tmp/wu; exit 1; }
  echo "  attempt $i: $code"
  sleep 5
done
echo "::endgroup::"

echo "::group::assert"
BODY=$(curl -fsS -m 120 -X POST "$WORKER_URL/agents/$AGENT/test" \
  -H 'content-type: application/json' \
  -d '{"message":"Say one word."}')
echo "$BODY"
# Assert: result.answer is a non-empty string
echo "$BODY" | grep -qE '"answer":"[^"]+"' || { echo "::error::answer missing/empty"; exit 1; }
echo "::endgroup::"

echo "✅ examples/workers-ai E2E pass"
