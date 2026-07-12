#!/usr/bin/env bash
# run-e2e.sh, full E2E for the event-trigger recipe (Flue 1.0 workflow).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

export EVENT_HMAC_SECRET="${EVENT_HMAC_SECRET:-dev-secret-rotate-me}"
WORKER_NAME=$(node -p "require('./package.json').name")
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)

cleanup() {
  set +e
  [[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
  if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
    if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
    else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
  fi
  rm -f "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
npx flue build --target cloudflare
echo "::endgroup::"

echo "::group::wrangler deploy"
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "EVENT_HMAC_SECRET:$EVENT_HMAC_SECRET" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
# Unsigned workflow call returns 200 { ok:false } fast — warms the route.
for i in $(seq 1 20); do
  code=$(curl -sS -m 60 -o /dev/null -w '%{http_code}' \
    "$WORKER_URL/workflows/event-trigger?wait=result" \
    -H 'content-type: application/json' -d '{"source":"generic","event":{"kind":"warmup"}}' 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "  workflow route live after $i attempts"; break; fi
  if [ "$i" = "20" ]; then echo "::error::workflow route still failing (HTTP $code)"; exit 1; fi
  sleep 4
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/workflows/event-trigger" \
  EVENT_HMAC_SECRET="$EVENT_HMAC_SECRET" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ recipe event-trigger E2E pass"
