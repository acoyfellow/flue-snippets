#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/vectorize"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

WORKER_NAME=$(node -p "require('./package.json').name")
INDEX_NAME="${WORKER_NAME}-$(date +%s)"
INDEX_CREATED=""
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$EXAMPLE/wrangler.jsonc"
BACKUP_CONFIG=$(mktemp)
cp "$SOURCE_CONFIG" "$BACKUP_CONFIG"

cleanup() {
	set +e
	[[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
	[[ -n "${INDEX_CREATED:-}" ]] && npx wrangler vectorize delete "$INDEX_NAME" --force >/dev/null 2>&1 || true
	if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
		"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
		if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
		else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
	fi
	cp "$BACKUP_CONFIG" "$SOURCE_CONFIG"
	rm -f "$BACKUP_CONFIG" "$DEPLOY_LOG" "$WORKERS_FILE"
}
trap cleanup EXIT

node -e 'const fs=require("fs"),p="wrangler.jsonc";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("REPLACE_VECTORIZE_INDEX",process.argv[1]));' "$INDEX_NAME"
npx wrangler vectorize create "$INDEX_NAME" --preset '@cf/baai/bge-base-en-v1.5'
INDEX_CREATED=1

npx flue build --target cloudflare
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
npx wrangler deploy --config "$DEPLOY_CONFIG" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

RESPONSE=""
for i in $(seq 1 25); do
	RESPONSE=$(curl -sS -m 90 "$URL/workflows/vectorize?wait=result" \
		-H 'content-type: application/json' \
		-d '{"docText":"octarine is the colour of magic","queryText":"what colour is magic?"}' || true)
	printf '%s' "$RESPONSE" | grep -q '"dimensions":768' && break
	[ "$i" = "25" ] && { echo "assert never returned 768-dim topMatch: $RESPONSE" >&2; exit 1; }
	sleep 4
done
printf '%s\n' "$RESPONSE"
printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
	const b=JSON.parse(s), r=b.result;
	// Embedding dimensions prove the AI + Vectorize path ran. The topMatch
	// KEY must be present, but a just-upserted vector may not be queryable
	// yet (Vectorize indexes asynchronously), so its value may be null —
	// matching the original 0.7.0 assertion semantics.
	if(!r || r.dimensions!==768 || !("topMatch" in r)){console.error("vectorize assertion failed",b);process.exit(1);}
	console.log("vectorize assertion passed", JSON.stringify(r));
});
'
