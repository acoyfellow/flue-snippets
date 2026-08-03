#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/d1"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

WORKER_NAME=$(node -p "require('./package.json').name")
DB_NAME="${WORKER_NAME}-$(date +%s)"
DB_CREATED=""
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$EXAMPLE/wrangler.jsonc"
BACKUP_CONFIG=$(mktemp)
cp "$SOURCE_CONFIG" "$BACKUP_CONFIG"

cleanup() {
	set +e
	[[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
	[[ -n "${DB_CREATED:-}" ]] && npx wrangler d1 delete "$DB_NAME" --skip-confirmation >/dev/null 2>&1 || true
	if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
		"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
		if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
		else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
	fi
	cp "$BACKUP_CONFIG" "$SOURCE_CONFIG"
	rm -f "$BACKUP_CONFIG" "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT

# Name is safe to substitute before create; wrangler d1 create prints the UUID.
node -e 'const fs=require("fs"),p="wrangler.jsonc";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("REPLACE_D1_NAME",process.argv[1]));' "$DB_NAME"
CREATE_OUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
DB_CREATED=1
printf '%s\n' "$CREATE_OUT"
DB_ID=$(printf '%s\n' "$CREATE_OUT" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
test -n "$DB_ID"
node -e 'const fs=require("fs"),p="wrangler.jsonc";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("REPLACE_D1_ID",process.argv[1]));' "$DB_ID"

npx vite build
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

CONV="e2e-d1-$(date +%s)"
for i in $(seq 1 40); do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 60 "$URL/agents/d1/warmup-$CONV" \
		-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
		-d '{"kind":"user","body":"Prepare to call the binding tool exactly once."}' || echo 000)
	[ "$code" = "202" ] && break
	[ "$i" = "40" ] && { echo "warmup never returned 202 (last $code)" >&2; exit 1; }
	sleep 3
done

# ADMIT retry: a freshly deployed Worker can answer 500/404 for a few
# seconds even after warmup, and a failed admit means the stream is
# never created — so retry until the agent really accepts the prompt.
ADMIT=""
for i in $(seq 1 20); do
	ADMIT=$(curl -sS -m 60 "$URL/agents/d1/$CONV" \
	-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
	-d '{"kind":"user","body":"Round-trip the note body hello from d1."}' || true)
	printf '%s' "$ADMIT" | grep -q '"streamUrl"' && break
	[ "$i" = "20" ] && { echo "agent never admitted the prompt: $ADMIT" >&2; exit 1; }
	sleep 3
done
printf 'admitted: %s\n' "$ADMIT"

RESPONSE=""
for i in $(seq 1 60); do
	RESPONSE=$(curl -sS -m 60 "$URL/agents/d1/$CONV" -H 'accept: application/json' -H "x-api-key: $SNIPPET_API_KEY" || true)
	printf '%s' "$RESPONSE" | grep -q '"match":true' && break
	[ "$i" = "60" ] && { echo "conversation never reported the expected binding result: $RESPONSE" >&2; exit 1; }
	sleep 3
done

printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data", d => s += d).on("end", () => {
	if (!s.includes("\"match\":true") || !s.includes("hello from d1")) {
		console.error("d1 assertion failed", s.slice(0, 600));
		process.exit(1);
	}
	console.log("d1 assertion passed: d1_round_trip reported match:true for hello from d1");
});
'
