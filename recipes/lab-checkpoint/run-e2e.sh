#!/usr/bin/env bash
# run-e2e.sh, full E2E for the lab-checkpoint recipe (Flue 1.0 workflow + Lab).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

: "${LAB_URL:?LAB_URL must be set in .env}"
WORKER_NAME=$(node -p "require('./package.json').name")
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$(pwd)/wrangler.jsonc"
BACKUP_CONFIG=$(mktemp)
cp "$SOURCE_CONFIG" "$BACKUP_CONFIG"

cleanup() {
  set +e
  [[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
  if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
    if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
    else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
  fi
  cp "$BACKUP_CONFIG" "$SOURCE_CONFIG"
  rm -f "$BACKUP_CONFIG" "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT INT TERM

# LAB_URL is a runtime var; substitute the placeholder from .env.
node -e 'const fs=require("fs"),p="wrangler.jsonc";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("REPLACE_LAB_URL",process.argv[1]));' "$LAB_URL"

echo "::group::flue build"
npx flue build --target cloudflare
echo "::endgroup::"

echo "::group::wrangler deploy"
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
npx wrangler deploy --config "$DEPLOY_CONFIG" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
for i in $(seq 1 20); do
  code=$(curl -sS -m 120 -o /tmp/warmup-body -w '%{http_code}' \
    "$WORKER_URL/workflows/lab-checkpoint?wait=result" \
    -H 'content-type: application/json' -d '{"message":"warmup"}' 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "  workflow route live after $i attempts"; break; fi
  if [ "$i" = "20" ]; then echo "::error::workflow route still failing (HTTP $code)"; head -c 400 /tmp/warmup-body; exit 1; fi
  sleep 4
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL="${WORKER_URL}/workflows/lab-checkpoint?wait=result" bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ recipe lab-checkpoint E2E pass"
