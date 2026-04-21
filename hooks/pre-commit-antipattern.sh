#!/usr/bin/env bash
# Detect NestJS/TypeScript antipatterns in staged TypeScript files before commit.
set -euo pipefail

# Get staged .ts files (exclude test files for some checks)
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.ts$' | grep -v '\.spec\.ts$' | grep -v '\.e2e-spec\.ts$' || true)

if [ -z "$STAGED_TS" ]; then
  exit 0
fi

ERRORS=0

for FILE in $STAGED_TS; do
  [ -f "$FILE" ] || continue

  # console.log / console.error in non-test TS files
  if grep -nE 'console\.(log|error|warn|debug)\(' "$FILE" 2>/dev/null; then
    echo "ERROR: console.log found in $FILE — use Logger from @nestjs/common"
    ERRORS=$((ERRORS + 1))
  fi

  # synchronize: true (TypeORM production footgun)
  if grep -n 'synchronize:\s*true' "$FILE" 2>/dev/null; then
    echo "ERROR: synchronize: true found in $FILE — use migrations instead"
    ERRORS=$((ERRORS + 1))
  fi

  # process.env. direct access (should use ConfigService)
  if grep -nE 'process\.env\.' "$FILE" 2>/dev/null | grep -v '// '; then
    echo "WARNING: process.env direct access in $FILE — use ConfigService.getOrThrow()"
  fi

  # new SomeService() — bypasses DI
  if grep -nE 'new [A-Z][a-zA-Z]+(Service|Repository|Provider)\(' "$FILE" 2>/dev/null; then
    echo "WARNING: Direct instantiation in $FILE — use NestJS dependency injection"
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Commit blocked: $ERRORS antipattern(s) found. Fix before committing."
  exit 1
fi

exit 0
