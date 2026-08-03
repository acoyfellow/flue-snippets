#!/usr/bin/env bash
# run-e2e.sh, full E2E for the do-governor recipe (Flue 1.0 workflow).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

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
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
export SNIPPET_API_KEY
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::warmup"
for i in $(seq 1 40); do
  code=$(curl -sS -m 120 -o /tmp/warmup-body -w '%{http_code}' \
    "$WORKER_URL/agents/do-governor/warmup" \
    -H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
    -d '{"kind":"user","body":"warmup"}' 2>/dev/null || echo "000")
  if [ "$code" = "202" ]; then echo "  agent route live after $i attempts"; break; fi
  if [ "$i" = "40" ]; then echo "::error::agent route still failing (HTTP $code)"; head -c 400 /tmp/warmup-body; exit 1; fi
  sleep 4
done
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL_BASE="${WORKER_URL}/agents/do-governor" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ recipe do-governor E2E pass"
