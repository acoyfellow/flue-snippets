#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/email-workers"
cd "$EXAMPLE"
# Local dev sources .env; CI provides these as real env vars.
if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi

# Self-contained: install this snippet's own Flue 2 deps if missing.
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

npx vite build
DIST_DIR=$(dirname "$(find dist -name wrangler.json -print -quit)")
DEPLOY_CONFIG="$DIST_DIR/wrangler.json"
npx wrangler deploy --dry-run --config "$DEPLOY_CONFIG"
SNIPPET_API_KEY="e2e-$(openssl rand -hex 16)"
npx wrangler deploy --config "$DEPLOY_CONFIG" --var "SNIPPET_API_KEY:$SNIPPET_API_KEY" 2>&1 | tee "$DEPLOY_LOG"
URL=$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1)
test -n "$URL"

CONV="e2e-email-workers-$(date +%s)"
for i in $(seq 1 40); do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 60 "$URL/agents/email-workers/warmup-$CONV" \
		-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
		-d '{"kind":"user","body":"Say ready."}' || echo 000)
	[ "$code" = "202" ] && break
	[ "$i" = "40" ] && { echo "warmup never returned 202 (last $code)" >&2; exit 1; }
	sleep 3
done

# ADMIT retry: a freshly deployed Worker can answer 500/404 for a few
# seconds even after warmup, and a failed admit means the stream is
# never created — so retry until the agent really accepts the prompt.
ADMIT=""
for i in $(seq 1 20); do
	ADMIT=$(curl -sS -m 60 "$URL/agents/email-workers/$CONV" \
	-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
	-d '{"kind":"user","body":"Send an email with subject flue-snippets E2E about confirming the Email Service pipeline from a deployed Flue agent."}' || true)
	printf '%s' "$ADMIT" | grep -q '"streamUrl"' && break
	[ "$i" = "20" ] && { echo "agent never admitted the prompt: $ADMIT" >&2; exit 1; }
	sleep 3
done
printf 'admitted: %s\n' "$ADMIT"

RESPONSE=""
for i in $(seq 1 60); do
	RESPONSE=$(curl -sS -m 60 "$URL/agents/email-workers/$CONV" -H 'accept: application/json' -H "x-api-key: $SNIPPET_API_KEY" || true)
	printf '%s' "$RESPONSE" | grep -q '"ok"' && break
	[ "$i" = "60" ] && { echo "conversation never returned an email result: $RESPONSE" >&2; exit 1; }
	sleep 3
done

printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
	const snapshot=JSON.parse(s);
	const output=snapshot.messages.flatMap((message)=>message.parts??[]).find((part)=>part.type==="dynamic-tool"&&part.toolName==="send_email"&&part.state==="output-available")?.output;
	if(!output || typeof output.ok!=="boolean"){console.error("email-workers assertion failed (no ok field)",snapshot);process.exit(1);}
	if(output.ok===true && typeof output.messageId==="string"){console.log("email-workers: real email sent",JSON.stringify(output));}
	else if(output.ok===false && /^E_[A-Z_]+$/.test(String(output.code))){console.log("email-workers: structured error (expected when sender unset/not onboarded)",JSON.stringify({code:output.code}));}
	else {console.error("email-workers assertion failed (neither send nor structured error)",snapshot);process.exit(1);}
});
'
