#!/usr/bin/env bash
#
# run-e2e.sh — full end-to-end harness for snippet 01.
#
# 1. Build the Flue agent for Cloudflare target.
# 2. Deploy to a unique Worker name on the personal CF account.
# 3. Run the gateproof plan against the deployed URL.
# 4. Tear down the Worker (always, even on failure).
#
# No mocks. No skips. The agent calls a real Workers AI model
# (llama-3.1-8b) and writes a real receipt to https://lab.coey.dev.
# Cost per run ≈ $0.0001 (Workers AI llama input tokens).
#
# Required env:
#   CLOUDFLARE_API_TOKEN     — token with Workers Scripts:Edit + Workers AI
#   CLOUDFLARE_ACCOUNT_ID    — personal account
#   LAB_URL                  — defaults to https://lab.coey.dev
#
# Optional:
#   GITHUB_SHA               — used in the worker name; defaults to local-<rand>

set -euo pipefail
cd "$(dirname "$0")"

SHA="${GITHUB_SHA:-local}-$(openssl rand -hex 3)"
SHA="${SHA:0:14}"
export WORKER_NAME="flue-01-lab-receipt-${SHA}"
LAB_URL="${LAB_URL:-https://lab.coey.dev}"

cleanup() {
  local code=$?
  echo "::group::cleanup"
  npx wrangler delete --name "$WORKER_NAME" --force 2>&1 || true
  echo "::endgroup::"
  exit $code
}
trap cleanup EXIT INT TERM

echo "::group::flue build"
rm -rf .build
npx flue build --target cloudflare --workspace . --output .build
# Flue's auto-generated wrangler.jsonc uses the output dir as the name
# (".build" — invalid). Patch it to the real worker name before deploy.
node -e "
  const fs = require('fs');
  const p = '.build/dist/wrangler.jsonc';
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  c.name = process.env.WORKER_NAME;
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
" || { echo "::error::failed to patch wrangler.jsonc"; exit 1; }
# Flue also writes .build/.wrangler/deploy/config.json which conflicts
# with our wrangler.jsonc (different base paths). Remove it.
rm -rf .build/.wrangler
echo "patched name to: $WORKER_NAME"
echo "::endgroup::"

echo "::group::wrangler deploy ($WORKER_NAME)"
cd .build/dist
npx wrangler deploy \
  --name "$WORKER_NAME" \
  --var "LAB_URL:${LAB_URL}" \
  --var "CLOUDFLARE_ACCOUNT_ID:${CLOUDFLARE_ACCOUNT_ID}" \
  --var "CLOUDFLARE_API_KEY:${CLOUDFLARE_API_TOKEN}" \
  2>&1 | tee /tmp/wrangler-deploy.log

WORKER_URL=$(grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' /tmp/wrangler-deploy.log | head -1)
if [ -z "$WORKER_URL" ]; then
  echo "::error::failed to capture deployed URL"
  exit 1
fi
cd ../..
echo "deployed: $WORKER_URL"
echo "::endgroup::"

echo "::group::gateproof plan against $WORKER_URL"
AGENT_URL="${WORKER_URL}/agents/lab-receipt/test-run-${SHA}" \
LAB_URL="${LAB_URL}" \
  bun run gateproof.plan.ts
echo "::endgroup::"

echo "✅ snippet 01 E2E pass"
