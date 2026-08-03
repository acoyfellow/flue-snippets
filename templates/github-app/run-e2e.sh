#!/usr/bin/env bash
# run-e2e.sh, full E2E for the github-app template (Flue 1.0 @flue/github channel).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

export GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-dev-secret-rotate-me}"
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

echo "::group::vite build"
npx vite build
echo "::endgroup::"

echo "::group::wrangler deploy"
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "GITHUB_WEBHOOK_SECRET:$GITHUB_WEBHOOK_SECRET" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
# Unsigned POST returns 401 fast once the route is live — use it to warm.
for i in $(seq 1 40); do
  code=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST \
    "$WORKER_URL/channels/github/webhook" \
    -H 'content-type: application/json' -H 'x-github-event: issues' -H 'x-github-delivery: warmup' \
    -d '{}' 2>/dev/null || echo "000")
  if [ "$code" = "401" ]; then echo "  channel route live after $i attempts"; break; fi
  if [ "$i" = "40" ]; then echo "::error::channel route not responding (HTTP $code)"; exit 1; fi
  sleep 3
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/channels/github/webhook" \
  GITHUB_WEBHOOK_SECRET="$GITHUB_WEBHOOK_SECRET" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ template github-app E2E pass"
