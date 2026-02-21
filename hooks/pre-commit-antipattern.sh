#!/usr/bin/env bash
# Pre-commit hook: detect anti-patterns in staged C# files
# Runs a quick lint pass on staged .cs files using dotnet build diagnostics.
# For full anti-pattern detection, use the Roslyn MCP detect_antipatterns tool.
#
# Exit codes:
#   0 — No issues found (or no .cs files staged)
#   1 — Issues found, commit blocked

set -euo pipefail

# Get staged .cs files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.cs$' || true)

if [[ -z "$STAGED_FILES" ]]; then
    exit 0
fi

echo "Checking staged C# files for common issues..."

ERRORS=0

for FILE in $STAGED_FILES; do
    if [[ ! -f "$FILE" ]]; then
        continue
    fi

    # Check for DateTime.Now / DateTime.UtcNow (should use TimeProvider)
    if grep -n 'DateTime\.\(Now\|UtcNow\)' "$FILE" 2>/dev/null; then
        echo "⚠️  $FILE: Use TimeProvider instead of DateTime.Now/UtcNow"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for new HttpClient() (should use IHttpClientFactory)
    if grep -n 'new HttpClient()' "$FILE" 2>/dev/null; then
        echo "⚠️  $FILE: Use IHttpClientFactory instead of new HttpClient()"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for async void (except event handlers)
    if grep -n 'async void' "$FILE" | grep -v 'EventArgs' 2>/dev/null; then
        echo "🔴 $FILE: async void is dangerous — use async Task instead"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for .Result or .GetAwaiter().GetResult() (sync-over-async)
    if grep -n '\.Result\b\|\.GetAwaiter()\.GetResult()' "$FILE" 2>/dev/null; then
        echo "🔴 $FILE: Avoid sync-over-async (.Result / .GetAwaiter().GetResult())"
        ERRORS=$((ERRORS + 1))
    fi
done

if [[ $ERRORS -gt 0 ]]; then
    echo ""
    echo "Found $ERRORS anti-pattern issue(s) in staged files."
    echo "Fix the issues above or use 'git commit --no-verify' to skip this check."
    exit 1
fi

echo "✓ No anti-patterns detected in staged files."
exit 0
