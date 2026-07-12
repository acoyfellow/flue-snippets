#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/r2"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own 1.0 deps if missing.
[ -d node_modules ] || bun install

WORKER_NAME=$(node -p "require('./package.json').name")
BUCKET_NAME="${WORKER_NAME}-$(date +%s)"
BUCKET_CREATED=""
DEPLOY_LOG=$(mktemp)
WORKERS_FILE=$(mktemp)
SOURCE_CONFIG="$EXAMPLE/wrangler.jsonc"
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
trap cleanup EXIT

# Substitute the bucket name into wrangler.jsonc FIRST — `wrangler r2 bucket
# create` reads the local config and rejects the placeholder otherwise.
node -e '
const fs=require("fs"),p="wrangler.jsonc";
fs.writeFileSync(p, fs.readFileSync(p,"utf8").replace("REPLACE_R2_BUCKET_NAME", process.argv[1]));
' "$BUCKET_NAME"
npx wrangler r2 bucket create "$BUCKET_NAME"
BUCKET_CREATED=1

npx flue build --target cloudflare
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
npx wrangler deploy --config "$DEPLOY_CONFIG" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

RESPONSE=""
for i in $(seq 1 20); do
	RESPONSE=$(curl -sS -m 60 "$URL/workflows/r2?wait=result" \
		-H 'content-type: application/json' \
		-d '{"key":"hello.txt","body":"hello from r2"}' || true)
	printf '%s' "$RESPONSE" | grep -q '"match":true' && break
	[ "$i" = "20" ] && { echo "assert never returned a valid result: $RESPONSE" >&2; exit 1; }
	sleep 3
done
printf '%s\n' "$RESPONSE"
printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
	const b=JSON.parse(s), r=b.result;
	if(!r || r.key!=="hello.txt" || r.read!=="hello from r2" || r.match!==true){console.error("r2 assertion failed",b);process.exit(1);}
	console.log("r2 assertion passed", JSON.stringify(r));
});
'
