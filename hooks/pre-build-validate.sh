#!/usr/bin/env bash
# Quick TypeScript validation before full build.
# Catches obvious type errors fast without full compilation artifacts.
set -euo pipefail

# Only run if tsconfig.json exists
if [ ! -f "tsconfig.json" ]; then
  exit 0
fi

# Skip if no TypeScript sources changed (optional — remove if too slow)
echo "[pre-build-validate] Running tsc --noEmit..."

if [ -x "./node_modules/.bin/tsc" ]; then
  ./node_modules/.bin/tsc --noEmit 2>&1 | head -30
elif command -v tsc &>/dev/null; then
  tsc --noEmit 2>&1 | head -30
fi

exit 0
