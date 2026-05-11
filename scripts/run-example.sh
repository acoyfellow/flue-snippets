#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
EXAMPLE="${1:-${FLUE_EXAMPLE:-${EXAMPLE:-}}}"
[ -z "$EXAMPLE" ] && { echo "usage: $0 <example-name>"; exit 2; }
WORKSPACE="$ROOT/examples/$EXAMPLE"
[ -d "$WORKSPACE" ] || { echo "unknown example: $EXAMPLE"; exit 2; }

export STAGE="${STAGE:-local}"
export FLUE_EXAMPLE="$EXAMPLE"
AGENT="$EXAMPLE"

cleanup() {
  local c=$?
  echo "::group::cleanup"
  (cd "$ROOT" && npx alchemy destroy --root-dir "$WORKSPACE" "$ROOT/scripts/alchemy.run.ts" --stage "$STAGE" 2>&1 || true)
  echo "::endgroup::"
  exit $c
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf "$WORKSPACE/.build" "$WORKSPACE/.alchemy" "$WORKSPACE/agents"
mkdir -p "$WORKSPACE/agents"
ln -sf "../$EXAMPLE.ts" "$WORKSPACE/agents/$EXAMPLE.ts"
npx flue build --target cloudflare --workspace "$WORKSPACE" --output "$WORKSPACE/.build"
echo "::endgroup::"

echo "::group::alchemy deploy"
LOG=$(mktemp)
(cd "$ROOT" && npx alchemy deploy --root-dir "$WORKSPACE" "$ROOT/scripts/alchemy.run.ts" --stage "$STAGE" 2>&1 | tee "$LOG")
URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' "$LOG" | tail -1)
[ -z "$URL" ] && { echo "::error::no URL"; exit 1; }
echo "deployed: $URL"
echo "::endgroup::"

post() {
  curl -fsS -m "${4:-30}" -X POST "$1/agents/$2/$3" -H 'content-type: application/json' -d "${5:-{}}"
}

warmup() {
  local url=$1 agent=$2 data timeout c
  data=$(payload_for "$agent" warmup); timeout=$(timeout_for "$agent" warmup)
  for i in $(seq 1 12); do
    c=$(curl -sS -m "$timeout" -o /tmp/wu -w '%{http_code}' -X POST \
      "$url/agents/$agent/warmup" -H 'content-type: application/json' -d "$data" 2>/dev/null || echo 000)
    [ "$c" = "200" ] && return 0
    [ "$i" = "12" ] && { echo "::error::HTTP $c"; cat /tmp/wu; exit 1; }
    sleep 5
  done
}

payload_for() {
  case "$1:$2" in
    kv:warmup) echo '{"key":"warmup","value":"hi"}' ;;
    kv:test) echo '{"key":"hello","value":"world"}' ;;
    r2:warmup) echo '{"key":"warmup.txt","body":"hi"}' ;;
    r2:test) echo '{"key":"hello.txt","body":"hello from r2"}' ;;
    d1:warmup) echo '{"body":"hi"}' ;;
    d1:test) echo '{"body":"hello from d1"}' ;;
    queues:warmup) echo '{"text":"warmup"}' ;;
    queues:test) echo '{"text":"hello queue"}' ;;
    vectorize:warmup) echo '{"docText":"warmup","queryText":"warmup"}' ;;
    vectorize:test) echo '{"docText":"octarine is the colour of magic","queryText":"what colour is magic?"}' ;;
    browser-rendering:*) echo '{"url":"https://example.com"}' ;;
    ai-gateway:warmup|workers-ai:warmup) echo '{"message":"warmup"}' ;;
    ai-gateway:test|workers-ai:test) echo '{"message":"Say one word."}' ;;
    durable-objects:*) echo '{"message":"hello"}' ;;
    worker-loader:*) echo '{}' ;;
    *) echo '{}' ;;
  esac
}

timeout_for() {
  case "$1" in
    ai-gateway|workers-ai) echo 120 ;;
    browser-rendering) echo 180 ;;
    vectorize) echo 60 ;;
    *) echo 30 ;;
  esac
}

assert() {
  local url=$1 agent=$2 body a b custom
  case "$agent" in
    ai-gateway)
      body=$(post "$url" "$agent" test 120 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -qE '"answer":"[^"]+"' || { echo "::error::answer missing"; exit 1; }
      echo "$body" | grep -q "\"gateway\":\"${CLOUDFLARE_GATEWAY_ID:-jordan}\"" || { echo "::error::gateway echo missing"; exit 1; }
      ;;
    browser-rendering)
      body=$(post "$url" "$agent" test 180 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -q '"title":"Example Domain"' || { echo "::error::wrong/missing title"; exit 1; }
      ;;
    d1|kv|r2)
      body=$(post "$url" "$agent" test 30 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -q '"match":true' || { echo "::error::round-trip didn't match"; exit 1; }
      ;;
    durable-objects)
      a=$(post "$url" "$agent" alice 30 '{"message":"hello"}'); b=$(post "$url" "$agent" bob 30 '{"message":"hello"}'); echo "$a"; echo "$b"
      echo "$a" | grep -q '"id":"alice"' || { echo "::error::alice route didn't echo id"; exit 1; }
      echo "$b" | grep -q '"id":"bob"' || { echo "::error::bob route didn't echo id"; exit 1; }
      ;;
    queues)
      body=$(post "$url" "$agent" test 30 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -q '"status":"enqueued"' || { echo "::error::not enqueued"; exit 1; }
      ;;
    vectorize)
      body=$(post "$url" "$agent" test 60 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -q '"dimensions":768' || { echo "::error::wrong dimensions"; exit 1; }
      echo "$body" | grep -q '"topMatch":' || { echo "::error::no topMatch"; exit 1; }
      ;;
    worker-loader)
      body=$(post "$url" "$agent" test 30 '{}'); echo "$body"
      echo "$body" | grep -q '"childStatus":200' || { echo "::error::child status not 200"; exit 1; }
      echo "$body" | grep -q '"from\\":\\"child\\"' || { echo "::error::child didn't run"; exit 1; }
      custom='{"code":"export default { fetch() { return new Response(\"hi from custom child\") } }"}'
      body=$(post "$url" "$agent" test2 30 "$custom"); echo "$body"
      echo "$body" | grep -q 'hi from custom child' || { echo "::error::custom child didn't run"; exit 1; }
      ;;
    workers-ai)
      body=$(post "$url" "$agent" test 120 "$(payload_for "$agent" test)"); echo "$body"
      echo "$body" | grep -qE '"answer":"[^"]+"' || { echo "::error::answer missing/empty"; exit 1; }
      ;;
    *) echo "no assertions for $agent"; exit 2 ;;
  esac
}

echo "::group::warmup"
for i in $(seq 1 30); do
  c=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$URL/health" 2>/dev/null || echo 000)
  [ "$c" = "200" ] && break
  [ "$i" = "30" ] && { echo "::error::/health failing"; exit 1; }
  sleep 1
done
warmup "$URL" "$AGENT"
echo "::endgroup::"

echo "::group::assert"
assert "$URL" "$AGENT"
echo "::endgroup::"

echo "✅ examples/$EXAMPLE E2E pass"

