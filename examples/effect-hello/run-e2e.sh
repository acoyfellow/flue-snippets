#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/effect-hello"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

WORKER_NAME=$(node -p "require('./package.json').name")
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)

cleanup() {
	set +e
	if [[ -n "${WORKER_NAME:-}" ]]; then
		npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
	fi
	if curl --fail --silent --show-error \
		-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
		"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
		if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then
			echo "worker remains after teardown: $WORKER_NAME" >&2
		else
			echo "zero leftover workers after teardown: $WORKER_NAME absent"
		fi
	fi
	rm -f "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT

npx flue build --target cloudflare
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
npx wrangler deploy --config "$DEPLOY_CONFIG" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

# Synchronous invocation is POST /workflows/<name>?wait=result -> { result, runId }.
# Retry through cold-start (route/DO warm-up can 404/500 before settling to 200).
# Model call: allow a generous per-request timeout.
RESPONSE=""
for i in $(seq 1 20); do
	RESPONSE=$(curl -sS -m 120 "$URL/workflows/effect-hello?wait=result" \
		-H 'content-type: application/json' \
		-d '{"name":"Ada"}' || true)
	printf '%s' "$RESPONSE" | grep -q '"greeting"' && break
	[ "$i" = "20" ] && { echo "assert never returned a greeting: $RESPONSE" >&2; exit 1; }
	sleep 4
done
printf '%s\n' "$RESPONSE"
printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data", d => s += d).on("end", () => {
	const body = JSON.parse(s);
	const result = body.result;
	if (!result || typeof result.greeting !== "string" || result.greeting.length === 0) {
		console.error("effect-hello assertion failed (empty/missing answer)", body);
		process.exit(1);
	}
	console.log("effect-hello assertion passed:", JSON.stringify(result.greeting));
});
'
