#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/kv"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own Flue 2 deps if missing.
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

npx vite build
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

# Flue 2 has no synchronous invoke route. POST /agents/kv/<id> admits the
# message (202) and the reply lands in the conversation; GET the same URL
# to read it back. Warm up until the Worker answers, then assert.
CONV="e2e-kv-$(date +%s)"
for i in $(seq 1 40); do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 60 "$URL/agents/kv/warmup-$CONV" \
		-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
		-d '{"kind":"user","body":"Round-trip key warmup with value ready."}' || echo 000)
	[ "$code" = "202" ] && break
	[ "$i" = "40" ] && { echo "warmup never returned 202 (last $code)" >&2; exit 1; }
	sleep 3
done

# ADMIT retry: a freshly deployed Worker can answer 500/404 for a few
# seconds even after warmup, and a failed admit means the stream is
# never created — so retry until the agent really accepts the prompt.
ADMIT=""
for i in $(seq 1 20); do
	ADMIT=$(curl -sS -m 60 "$URL/agents/kv/$CONV" \
	-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
	-d '{"kind":"user","body":"Round-trip the key e2e-kv with the value round-trip."}' || true)
	printf '%s' "$ADMIT" | grep -q '"streamUrl"' && break
	[ "$i" = "20" ] && { echo "agent never admitted the prompt: $ADMIT" >&2; exit 1; }
	sleep 3
done
printf 'admitted: %s\n' "$ADMIT"

# Poll the conversation until the tool result appears in a settled reply.
RESPONSE=""
for i in $(seq 1 60); do
	RESPONSE=$(curl -sS -m 60 "$URL/agents/kv/$CONV" -H 'accept: application/json' -H "x-api-key: $SNIPPET_API_KEY" || true)
	printf '%s' "$RESPONSE" | grep -q '"match":true' && break
	[ "$i" = "60" ] && { echo "conversation never reported a successful round trip: $RESPONSE" >&2; exit 1; }
	sleep 3
done

printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data", d => s += d).on("end", () => {
	if (!s.includes("\"match\":true")) {
		console.error("round-trip assertion failed", s.slice(0, 600));
		process.exit(1);
	}
	if (!s.includes("e2e-kv") || !s.includes("round-trip")) {
		console.error("round-trip ran but did not carry the expected key/value", s.slice(0, 600));
		process.exit(1);
	}
	console.log("round-trip assertion passed: kv_round_trip reported match:true for e2e-kv");
});
'
