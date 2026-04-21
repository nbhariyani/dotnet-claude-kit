#!/usr/bin/env bash
# Verify staged TypeScript files pass ESLint and Prettier before commit.
set -euo pipefail

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' | grep -v node_modules | grep -v dist || true)

if [ -z "$STAGED_TS" ]; then
  exit 0
fi

LINT_ERRORS=0
FORMAT_ERRORS=0

# Prettier format check
if [ -x "./node_modules/.bin/prettier" ]; then
  for FILE in $STAGED_TS; do
    [ -f "$FILE" ] || continue
    if ! ./node_modules/.bin/prettier --check "$FILE" 2>/dev/null; then
      echo "FORMAT: $FILE needs formatting — run: prettier --write $FILE"
      FORMAT_ERRORS=$((FORMAT_ERRORS + 1))
    fi
  done
fi

# ESLint check
if [ -x "./node_modules/.bin/eslint" ]; then
  for FILE in $STAGED_TS; do
    [ -f "$FILE" ] || continue
    if ! ./node_modules/.bin/eslint "$FILE" --max-warnings=0 2>/dev/null; then
      echo "LINT: $FILE has lint errors — run: eslint --fix $FILE"
      LINT_ERRORS=$((LINT_ERRORS + 1))
    fi
  done
fi

TOTAL=$((LINT_ERRORS + FORMAT_ERRORS))
if [ "$TOTAL" -gt 0 ]; then
  echo ""
  echo "Commit blocked: $FORMAT_ERRORS format error(s), $LINT_ERRORS lint error(s)."
  echo "Run: npm run lint:fix && npm run format"
  exit 1
fi

exit 0
