#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/email-workers"
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
	[[ -n "${WORKER_NAME:-}" ]] && npx wrangler delete --name "$WORKER_NAME" --force >/dev/null 2>&1 || true
	if curl --fail --silent --show-error -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
		"https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" >"$WORKERS_FILE"; then
		if grep -Fq "\"$WORKER_NAME\"" "$WORKERS_FILE"; then echo "worker remains after teardown: $WORKER_NAME" >&2
		else echo "zero leftover workers after teardown: $WORKER_NAME absent"; fi
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

# Two valid outcomes: (a) real send -> ok:true + messageId (verified sender
# onboarded + EMAIL_FROM/EMAIL_TO set); (b) unset/not-onboarded -> ok:false
# with a structured E_* code. Retry only through cold-start (missing "ok" key).
RESPONSE=""
for i in $(seq 1 20); do
	RESPONSE=$(curl -sS -m 120 "$URL/workflows/email-workers?wait=result" \
		-H 'content-type: application/json' \
		-d '{"subject":"flue-snippets E2E","context":"Confirming the Email Service pipeline from a deployed Flue workflow."}' || true)
	printf '%s' "$RESPONSE" | grep -q '"ok"' && break
	[ "$i" = "20" ] && { echo "assert never returned an ok field: $RESPONSE" >&2; exit 1; }
	sleep 4
done
printf '%s\n' "$RESPONSE"
printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
	const b=JSON.parse(s), r=b.result;
	if(!r || typeof r.ok!=="boolean"){console.error("email-workers assertion failed (no ok field)",b);process.exit(1);}
	if(r.ok===true && typeof r.messageId==="string"){console.log("email-workers: real email sent", JSON.stringify(r));}
	else if(r.ok===false && /^E_[A-Z_]+$/.test(String(r.code))){console.log("email-workers: structured error (expected when sender unset/not onboarded)", JSON.stringify({code:r.code}));}
	else {console.error("email-workers assertion failed (neither send nor structured error)",b);process.exit(1);}
});
'
