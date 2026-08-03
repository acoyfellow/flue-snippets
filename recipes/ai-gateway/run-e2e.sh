#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install
WORKER_NAME=$(node -p "require('./package.json').name")
DEPLOY_LOG=$(mktemp); WORKERS_FILE=$(mktemp)
cleanup() {
  set +e
  [[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
  if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
    if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains: $WORKER_NAME" >&2
    else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
  fi
  rm -f "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT INT TERM
echo "::group::vite build"; npx vite build; echo "::endgroup::"
echo "::group::wrangler deploy"
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
export SNIPPET_API_KEY
npx wrangler deploy --config "$DIST_DIR/wrangler.json" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
WORKER_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1); test -n "$WORKER_URL"
echo "deployed: $WORKER_URL"; echo "::endgroup::"
echo "::group::warmup"
for i in $(seq 1 40); do
  code=$(curl -sS -m 120 -o /dev/null -w '%{http_code}' "$WORKER_URL/agents/ai-gateway/warmup" -H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" -d '{"kind":"user","body":"warmup"}' 2>/dev/null || echo 000)
  [ "$code" = "202" ] && { echo "  live after $i"; break; }
  [ "$i" = "40" ] && { echo "::error::route failing $code"; exit 1; }
  sleep 4
done
echo "::endgroup::"
echo "::group::gateproof"
AGENT_URL_BASE="${WORKER_URL}/agents/ai-gateway" bun run gateproof.plan.ts
echo "::endgroup::"
echo "✅ recipe ai-gateway E2E pass"
