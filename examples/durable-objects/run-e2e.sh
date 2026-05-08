#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export STAGE="${STAGE:-local}"
AGENT="durable-objects"

cleanup() { local c=$?; echo "::group::cleanup"; npx alchemy destroy --stage "$STAGE" 2>&1 || true; echo "::endgroup::"; exit $c; }
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf .build .alchemy
npx flue build --target cloudflare --workspace . --output .build
echo "::endgroup::"

echo "::group::alchemy deploy"
LOG=$(mktemp); npx alchemy deploy --stage "$STAGE" 2>&1 | tee "$LOG"
URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' "$LOG" | tail -1)
[ -z "$URL" ] && { echo "::error::no URL"; exit 1; }
echo "deployed: $URL"
echo "::endgroup::"

echo "::group::warmup"
for i in $(seq 1 30); do
  c=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$URL/health" 2>/dev/null || echo 000)
  [ "$c" = "200" ] && break
  [ "$i" = "30" ] && { echo "::error::/health failing"; exit 1; }
  sleep 1
done
for i in $(seq 1 12); do
  c=$(curl -sS -m 60 -o /tmp/wu -w '%{http_code}' -X POST \
    "$URL/agents/$AGENT/warmup" -H 'content-type: application/json' \
    -d '{"message":"hi"}' 2>/dev/null || echo 000)
  [ "$c" = "200" ] && break
  [ "$i" = "12" ] && { echo "::error::HTTP $c"; cat /tmp/wu; exit 1; }
  sleep 5
done
echo "::endgroup::"

echo "::group::assert"
A=$(curl -fsS -m 30 -X POST "$URL/agents/$AGENT/alice" \
  -H 'content-type: application/json' -d '{"message":"hello"}')
B=$(curl -fsS -m 30 -X POST "$URL/agents/$AGENT/bob" \
  -H 'content-type: application/json' -d '{"message":"hello"}')
echo "alice: $A"
echo "bob:   $B"
echo "$A" | grep -q '"id":"alice"' || { echo "::error::alice route didn't echo id"; exit 1; }
echo "$B" | grep -q '"id":"bob"'   || { echo "::error::bob route didn't echo id"; exit 1; }
echo "::endgroup::"

echo "✅ examples/durable-objects E2E pass"
