#!/usr/bin/env bash
# Thin shim — delegates to the shared examples harness.
set -euo pipefail
exec "$(dirname "$0")/../../scripts/run-example.sh" email-workers
