#!/usr/bin/env bash
# Auto-install dependencies after package.json changes.
set -euo pipefail

FILE="$1"

# Only run for package.json changes
case "$FILE" in
  */package.json) ;;
  *) exit 0 ;;
esac

# Skip node_modules package.json files
case "$FILE" in
  */node_modules/*) exit 0 ;;
esac

echo "[post-scaffold-restore] package.json changed — installing dependencies..."

# Prefer pnpm if lock file exists
if [ -f "pnpm-lock.yaml" ]; then
  pnpm install 2>&1 | tail -5
elif [ -f "yarn.lock" ]; then
  yarn install 2>&1 | tail -5
else
  npm install 2>&1 | tail -5
fi

echo "[post-scaffold-restore] Done."
exit 0
