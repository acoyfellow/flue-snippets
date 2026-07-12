#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/kv"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

WORKER_NAME=$(node -p "require('./package.json').name")
KV_NAME="${WORKER_NAME}-$(date +%s)"
KV_ID=""
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$EXAMPLE/wrangler.jsonc"
BACKUP_CONFIG=$(mktemp)
cp "$SOURCE_CONFIG" "$BACKUP_CONFIG"

cleanup() {
	set +e
	if [[ -n "${WORKER_NAME:-}" ]]; then
		npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
	fi
	if [[ -n "${KV_ID:-}" ]]; then
		npx wrangler kv namespace delete --namespace-id "$KV_ID" >/dev/null 2>&1 || true
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
	cp "$BACKUP_CONFIG" "$SOURCE_CONFIG"
	rm -f "$BACKUP_CONFIG" "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT

KV_CREATE=$(npx wrangler kv namespace create "$KV_NAME")
KV_ID=$(printf '%s\n' "$KV_CREATE" | grep -Eo '"id": "[a-f0-9]+"' | head -1 | cut -d\" -f4)
test -n "$KV_ID"

node -e '
const fs = require("fs");
const p = "wrangler.jsonc";
const s = fs.readFileSync(p, "utf8").replace("REPLACE_KV_NAMESPACE_ID", process.argv[1]);
fs.writeFileSync(p, s);
' "$KV_ID"

npx flue build --target cloudflare
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
npx wrangler deploy --config "$DEPLOY_CONFIG" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

# Warmup + assert both hit the synchronous ?wait=result path. A bare
# POST /workflows/kv (no wait) is a fire-and-forget admit whose 202/404
# shape varies; ?wait=result is the documented synchronous invocation.
for i in $(seq 1 20); do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 60 "$URL/workflows/kv?wait=result" \
		-H 'content-type: application/json' \
		-d '{"key":"warmup","value":"ready"}' || echo 000)
	[ "$code" = "200" ] && break
	[ "$i" = "20" ] && { echo "warmup never returned 200 (last $code)" >&2; exit 1; }
	sleep 3
done
RESPONSE=""
for i in $(seq 1 20); do
	RESPONSE=$(curl -sS -m 60 "$URL/workflows/kv?wait=result" \
		-H 'content-type: application/json' \
		-d '{"key":"e2e-kv","value":"round-trip"}' || true)
	printf '%s' "$RESPONSE" | grep -q '"match":true' && break
	[ "$i" = "20" ] && { echo "assert never returned a valid result: $RESPONSE" >&2; exit 1; }
	sleep 3
done
printf '%s\n' "$RESPONSE"
printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data", d => s += d).on("end", () => {
	const body = JSON.parse(s);
	const result = body.result;
	if (!result || result.key !== "e2e-kv" || result.read !== "round-trip" || result.match !== true) {
		console.error("round-trip assertion failed", body);
		process.exit(1);
	}
	console.log("round-trip assertion passed", JSON.stringify(result));
});
'

