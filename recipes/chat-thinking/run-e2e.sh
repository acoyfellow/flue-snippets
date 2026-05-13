#!/usr/bin/env bash
#
# run-e2e.sh, full E2E for the chat-thinking recipe.

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

echo "::group::warmup"
for i in $(seq 1 30); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$WORKER_URL/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "  /health live after ${i}s"; break; fi
  if [ "$i" = "30" ]; then echo "::error::/health not responding after 30s"; exit 1; fi
  sleep 1
done
for i in $(seq 1 12); do
  code=$(curl -sS -m 120 -o /tmp/warmup-body -w '%{http_code}' -X POST \
    "$WORKER_URL/agents/chat-thinking/warmup" \
    -H 'content-type: application/json' \
    -d '{"message":"warmup"}' 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "  agent route live after $i attempts"; break; fi
  if [ "$i" = "12" ]; then echo "::error::agent route still failing (HTTP $code)"; head -c 400 /tmp/warmup-body; exit 1; fi
  echo "  attempt $i: HTTP $code; retrying in 5s"
  sleep 5
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/agents/chat-thinking" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet chat-thinking E2E pass"
