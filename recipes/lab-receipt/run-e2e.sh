#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for the lab-receipt snippet.
#
# 1. flue build       → .build/dist/_entry.ts
# 2. alchemy deploy   → declares Worker + DO + vars, prints URL
# 3. Warmup           → poll /health, then POST agent route until 200
#                       (covers both edge propagation and Workers AI cold
#                       start; without this every fresh deploy flakes
#                       under matrix contention)
# 4. gateproof        → run probe.ts to assert the snippet's contract
# 5. alchemy destroy  → tears worker + R2 + state down on exit
#
# No mocks. No skips.

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

echo "::group::warmup"
# Two-stage warmup: cheap /health first, then real agent POST. Both have
# generous per-request timeouts and exponential-ish backoff.
for i in $(seq 1 30); do
  code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' \
    "$WORKER_URL/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  /health live after ${i}s"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "::error::/health not responding after 30s"
    exit 1
  fi
  sleep 1
done
for i in $(seq 1 12); do
  code=$(curl -sS -m 120 -o /tmp/warmup-body -w '%{http_code}' -X POST \
    "$WORKER_URL/agents/lab-receipt/warmup" \
    -H 'content-type: application/json' \
    -d '{"message":"warmup"}' 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  agent route live after $i attempts"
    break
  fi
  if [ "$i" = "12" ]; then
    echo "::error::agent route still failing (HTTP $code)"
    head -c 400 /tmp/warmup-body 2>/dev/null
    exit 1
  fi
  echo "  attempt $i: HTTP $code; retrying in 5s"
  sleep 5
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL="${WORKER_URL}/agents/lab-receipt/gp-${STAGE}" \
LAB_URL="${LAB_URL}" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet lab-receipt E2E pass"
