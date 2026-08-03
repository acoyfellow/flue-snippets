#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi
[ -d node_modules ] || bun install
WORKER_NAME=$(node -p "require('./package.json').name")
BUCKET_NAME="${WORKER_NAME}-$(date +%s)"
BUCKET_CREATED=""
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$(pwd)/wrangler.jsonc"
BACKUP_CONFIG=$(mktemp)
cp "$SOURCE_CONFIG" "$BACKUP_CONFIG"
cleanup() {
  set +e
  [[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
  [[ -n "${BUCKET_CREATED:-}" ]] && npx wrangler r2 bucket delete "$BUCKET_NAME" >/dev/null 2>&1 || true
  if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
    if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
    else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
  fi
  cp "$BACKUP_CONFIG" "$SOURCE_CONFIG"
  rm -f "$BACKUP_CONFIG" "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT INT TERM
node -e 'const fs=require("fs"),p="wrangler.jsonc";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("replace-r2-bucket-name",process.argv[1]));' "$BUCKET_NAME"
npx wrangler r2 bucket create "$BUCKET_NAME"
BUCKET_CREATED=1
echo "::group::vite build"
npx vite build
echo "::endgroup::"
echo "::group::wrangler deploy"
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
export SNIPPET_API_KEY
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"
echo "::endgroup::"
echo "::group::warmup"
WARMUP_URL="$WORKER_URL/agents/virtual-sandbox/warmup"
for i in $(seq 1 40); do
  code=$(curl -sS -m 120 -o /tmp/warmup-body -w '%{http_code}' "$WARMUP_URL" -X POST -H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" -d '{"kind":"user","body":"What colour is magic?"}' 2>/dev/null || echo "000")
  if [ "$code" = "202" ] || [ "$code" = "200" ]; then curl -sS -m 120 "$WARMUP_URL" >/tmp/warmup-body || true; echo "  agent route live after $i attempts"; break; fi
  if [ "$i" = "40" ]; then echo "::error::agent route still failing (HTTP $code)"; head -c 400 /tmp/warmup-body; exit 1; fi
  sleep 4
done
echo "::endgroup::"
echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/agents/virtual-sandbox" bun run gateproof.plan.ts
echo "::endgroup::"
echo "✅ recipe virtual-sandbox E2E pass"
