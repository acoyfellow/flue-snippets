#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export STAGE="${STAGE:-local}"
AGENT="browser-rendering"

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
# Browser cold start is heavier than Workers AI \u2014 give it more time.
for i in $(seq 1 12); do
  c=$(curl -sS -m 180 -o /tmp/wu -w '%{http_code}' -X POST \
    "$URL/agents/$AGENT/warmup" -H 'content-type: application/json' \
    -d '{"url":"https://example.com"}' 2>/dev/null || echo 000)
  [ "$c" = "200" ] && break
  [ "$i" = "12" ] && { echo "::error::HTTP $c"; cat /tmp/wu; exit 1; }
  sleep 5
done
echo "::endgroup::"

echo "::group::assert"
BODY=$(curl -fsS -m 180 -X POST "$URL/agents/$AGENT/test" \
  -H 'content-type: application/json' -d '{"url":"https://example.com"}')
echo "$BODY"
echo "$BODY" | grep -q '"title":"Example Domain"' || { echo "::error::wrong/missing title"; exit 1; }
echo "::endgroup::"

echo "✅ examples/browser-rendering E2E pass"
