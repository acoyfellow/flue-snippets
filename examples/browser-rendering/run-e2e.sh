#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXAMPLE="$ROOT/examples/browser-rendering"
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

CONV="e2e-browser-rendering-$(date +%s)"
for i in $(seq 1 40); do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 180 "$URL/agents/browser-rendering/warmup-$CONV" \
		-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
		-d '{"kind":"user","body":"Say ready."}' || echo 000)
	[ "$code" = "202" ] && break
	[ "$i" = "40" ] && { echo "warmup never returned 202 (last $code)" >&2; exit 1; }
	sleep 3
done

ADMIT=$(curl -sS -m 180 "$URL/agents/browser-rendering/$CONV" \
	-H 'content-type: application/json' \
		-H "x-api-key: $SNIPPET_API_KEY" \
	-d '{"kind":"user","body":"Open https://example.com and report its page title."}')
printf 'admitted: %s\n' "$ADMIT"

RESPONSE=""
for i in $(seq 1 60); do
	RESPONSE=$(curl -sS -m 180 "$URL/agents/browser-rendering/$CONV" -H 'accept: application/json' -H "x-api-key: $SNIPPET_API_KEY" || true)
	printf '%s' "$RESPONSE" | grep -q '"title":"Example Domain"' && break
	[ "$i" = "60" ] && { echo "conversation never returned Example Domain title: $RESPONSE" >&2; exit 1; }
	sleep 3
done

printf '%s' "$RESPONSE" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
	const snapshot=JSON.parse(s);
	const output=snapshot.messages.flatMap((message)=>message.parts??[]).find((part)=>part.type==="dynamic-tool"&&part.toolName==="render_page"&&part.state==="output-available")?.output;
	if(!output||output.title!=="Example Domain"){console.error("browser-rendering assertion failed",snapshot);process.exit(1);}
	console.log("browser-rendering assertion passed",JSON.stringify(output));
});
'
