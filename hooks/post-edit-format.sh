#!/usr/bin/env bash
# Auto-format edited TypeScript/JavaScript files with Prettier + ESLint.
# Claude Code invokes this hook after each file edit.
set -euo pipefail

FILE="$1"

# Only run on TS/JS files
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mts|*.cts) ;;
  *) exit 0 ;;
esac

# Skip node_modules and dist
case "$FILE" in
  */node_modules/*|*/dist/*|*/.next/*) exit 0 ;;
esac

# Run prettier if available
if command -v prettier &>/dev/null; then
  prettier --write "$FILE" 2>/dev/null || true
elif [ -x "./node_modules/.bin/prettier" ]; then
  ./node_modules/.bin/prettier --write "$FILE" 2>/dev/null || true
fi

# Run eslint --fix if available
if command -v eslint &>/dev/null; then
  eslint --fix "$FILE" 2>/dev/null || true
elif [ -x "./node_modules/.bin/eslint" ]; then
  ./node_modules/.bin/eslint --fix "$FILE" 2>/dev/null || true
fi

exit 0
