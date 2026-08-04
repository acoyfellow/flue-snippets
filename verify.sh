#!/usr/bin/env bash
# Offline verification for every Flue snippet in this repo.
#
#   ./verify.sh            check every package
#   ./verify.sh kv d1      check named packages only
#
# Live deploy verification is deliberately NOT here: each snippet's
# run-e2e.sh deploys real Cloudflare resources and costs money. Run those
# explicitly with `bun run ex:<name>` / `bun run rx:<name>`.
set -uo pipefail
cd "$(dirname "$0")"

PASS=$'\033[32m✓\033[0m'
FAIL=$'\033[31m✗\033[0m'
SKIP=$'\033[33m-\033[0m'

ok=0
bad=0
skipped=0

report() { printf '  %b %-44s %s\n' "$1" "$2" "${3:-}"; }
record() { if [[ $1 -eq 0 ]]; then ok=$((ok + 1)); else bad=$((bad + 1)); fi; }

packages() {
	find examples recipes templates -mindepth 1 -maxdepth 1 -type d \
		-not -path '*/node_modules*' | sort
}

# A bare name like `ai-gateway` exists under BOTH examples/ and recipes/.
# Match a tier-qualified path (examples/ai-gateway) exactly; match a bare
# name only when it is unambiguous, and say so when it is not.
TARGETS=()
if [[ $# -gt 0 ]]; then
	for name in "$@"; do
		matches=()
		while IFS= read -r dir; do
			[[ "${dir#./}" == "${name#./}" || "$(basename "$dir")" == "$name" ]] && matches+=("$dir")
		done < <(packages)
		case ${#matches[@]} in
			0) echo "No package matched: $name" >&2; exit 2 ;;
			1) TARGETS+=("${matches[0]}") ;;
			*)
				if [[ "$name" == */* ]]; then
					TARGETS+=("${matches[@]}")
				else
					echo "Ambiguous package name '$name'. It exists in more than one tier:" >&2
					printf '  %s\n' "${matches[@]}" >&2
					echo "Qualify it, e.g. ./verify.sh examples/$name" >&2
					exit 2
				fi
				;;
		esac
	done
else
	while IFS= read -r dir; do TARGETS+=("$dir"); done < <(packages)
	SCANNING_WHOLE_REPO=1
fi

strip_comments() { sed -E 's|^[[:space:]]*//.*$||' "$1"; }

echo "==> Removed Flue APIs (source, harnesses, and docs)"
LEGACY=""
for dir in "${TARGETS[@]}"; do
	while IFS= read -r file; do
		strip_comments "$file" |
			sed -E 's#\.github/workflows/[A-Za-z0-9_.-]+##g; s#actions/workflows/[A-Za-z0-9_.-]+##g' |
			grep -qE 'defineWorkflow|defineAgent|WorkflowRouteHandler|WorkflowRunsHandler|flue build|flue dev|\?wait=|/workflows/' &&
			LEGACY="${LEGACY}${file}"$'\n'
	done < <(find "$dir" \( -name '*.ts' -o -name '*.sh' -o -name '*.md' \) -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.context/*' 2>/dev/null)
done
if [[ -n "${SCANNING_WHOLE_REPO:-}" ]]; then
	for doc in README.md CONTRIBUTING.md SECURITY.md; do
		[[ -f "$doc" ]] || continue
		sed -E 's#\.github/workflows/[A-Za-z0-9_.-]+##g; s#actions/workflows/[A-Za-z0-9_.-]+##g; s#developers\.cloudflare\.com/workflows/?##g' "$doc" |
			grep -qE 'defineWorkflow|defineAgent|WorkflowRouteHandler|flue build|flue dev|\?wait=|/workflows/' &&
			LEGACY="${LEGACY}${doc}"$'\n'
	done
fi
LEGACY=$(printf '%s' "$LEGACY")
if [[ -z "$LEGACY" ]]; then
	report "$PASS" "no removed APIs referenced"
	record 0
else
	report "$FAIL" "removed Flue APIs still referenced"
	printf '%s\n' "$LEGACY" | sed 's/^/       /'
	record 1
fi

echo "==> Public-repo hygiene (no internal registry in lockfiles)"
LEAK=""
SCAN_DIRS=("${TARGETS[@]}")
if [[ -n "${SCANNING_WHOLE_REPO:-}" ]]; then
	SCAN_DIRS+=("." "site")
fi
for dir in "${SCAN_DIRS[@]}"; do
	[[ -f "$dir/bun.lock" ]] || continue
	grep -qiE 'cloudflare-ui|cfdata|cloudflareaccess|artifactory' "$dir/bun.lock" && LEAK="${LEAK}${dir}/bun.lock"$'\n'
done
LEAK=$(printf '%s' "$LEAK")
if [[ -z "$LEAK" ]]; then
	report "$PASS" "no internal registry URLs in lockfiles"
	record 0
else
	report "$FAIL" "internal registry URL leaked into a public lockfile"
	printf '%s\n' "$LEAK" | sed 's/^/       /'
	record 1
fi

echo "==> Harness placeholder integrity"
ORPHAN=""
for dir in "${TARGETS[@]}"; do
	harness="$dir/run-e2e.sh"
	config="$dir/wrangler.jsonc"
	[[ -f "$harness" && -f "$config" ]] || continue
	while read -r sentinel; do
		[[ -n "$sentinel" ]] || continue
		grep -qF "$sentinel" "$harness" ||
			ORPHAN="${ORPHAN}${dir}: config sentinel '${sentinel}' is never substituted"$'\n'
	done < <(grep -oiE '"[a-z_]*(name|id|queue|index)": "(replace|REPLACE)[^"]*"' "$config" | sed 's/.*: "//;s/"//')
	while read -r target; do
		[[ -n "$target" ]] || continue
		grep -qF "$target" "$config" ||
			ORPHAN="${ORPHAN}${dir}: harness substitutes '${target}' but the config has no such string"$'\n'
	done < <(grep -oE '\.replace\("[^"]+"' "$harness" | sed 's/\.replace("//;s/"//')
done
ORPHAN=$(printf '%s' "$ORPHAN")
if [[ -z "$ORPHAN" ]]; then
	report "$PASS" "every binding placeholder is substituted by its harness"
	record 0
else
	report "$FAIL" "binding placeholder would deploy unsubstituted (resource leak risk)"
	printf '%s\n' "$ORPHAN" | sed 's/^/       /'
	record 1
fi

echo "==> Per-package checks"
for dir in "${TARGETS[@]}"; do
	name=$(basename "$dir")
	[[ -f "$dir/package.json" ]] || continue

	if [[ ! -d "$dir/src/agents" ]]; then
		report "$FAIL" "$name" "no src/agents, not migrated"
		record 1
		continue
	fi

	missing=""
	for required in src/app.ts vite.config.ts tsconfig.json .npmrc; do
		[[ -e "$dir/$required" ]] || missing="$missing $required"
	done
	if [[ -n "$missing" ]]; then
		report "$FAIL" "$name" "missing:$missing"
		record 1
		continue
	fi

	vite_range=$(node -p "((require('./$dir/package.json').devDependencies)||{}).vite||'none'" 2>/dev/null)
	if [[ "$vite_range" != ^8.* ]]; then
		report "$FAIL" "$name" "vite must be ^8.x (the 'use agent' scanner cannot parse TS on vite 7), got $vite_range"
		record 1
		continue
	fi

	if [[ ! -d "$dir/node_modules" ]]; then
		report "$SKIP" "$name" "no node_modules, run bun install"
		skipped=$((skipped + 1))
		continue
	fi

	if ! (cd "$dir" && ./node_modules/.bin/tsc --noEmit >/dev/null 2>&1); then
		report "$FAIL" "$name" "tsc --noEmit failed"
		record 1
		continue
	fi

	if ! (cd "$dir" && bunx vite build >/dev/null 2>&1); then
		report "$FAIL" "$name" "vite build failed"
		record 1
		continue
	fi

	declared_class=$(grep -oE '"tag": "flue-2-class-Flue[A-Za-z0-9]+Agent"' "$dir/wrangler.jsonc" 2>/dev/null | sed 's/.*class-//;s/"//' | head -1)
	bundle=$(find "$dir/dist" -name 'index.js' 2>/dev/null | head -1)
	if [[ -n "$declared_class" && -n "$bundle" ]] && ! grep -qF "$declared_class" "$bundle"; then
		report "$FAIL" "$name" "wrangler.jsonc declares $declared_class but the built bundle does not define it"
		record 1
		continue
	fi

	report "$PASS" "$name" "typecheck + build"
	record 0
done

echo
printf '==> %s passed, %s failed, %s skipped\n' "$ok" "$bad" "$skipped"
[[ $bad -eq 0 ]]
