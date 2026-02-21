#!/usr/bin/env bash
# Post-test hook: analyze test results and output actionable summary
# Parses dotnet test output for failures and provides a structured report.
#
# Usage: Pipe dotnet test output or pass log file as argument.
# Called automatically after test runs to summarize results.

set -euo pipefail

LOG_FILE="${1:-}"
TEST_OUTPUT=""

if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
    TEST_OUTPUT=$(cat "$LOG_FILE")
else
    # Read from stdin if available
    if [[ ! -t 0 ]]; then
        TEST_OUTPUT=$(cat)
    else
        echo "Usage: dotnet test 2>&1 | bash hooks/post-test-analyze.sh"
        echo "   or: bash hooks/post-test-analyze.sh <test-output.log>"
        exit 0
    fi
fi

# Count results
PASSED=$(echo "$TEST_OUTPUT" | grep -c 'Passed!' 2>/dev/null || echo "0")
FAILED=$(echo "$TEST_OUTPUT" | grep -c 'Failed!' 2>/dev/null || echo "0")
SKIPPED=$(echo "$TEST_OUTPUT" | grep -c 'Skipped!' 2>/dev/null || echo "0")

# Extract failure details
FAILURES=$(echo "$TEST_OUTPUT" | grep -A 5 'Failed ' 2>/dev/null || true)

echo ""
echo "═══════════════════════════════════"
echo "  Test Results Summary"
echo "═══════════════════════════════════"
echo ""

if [[ "$FAILED" -gt 0 ]]; then
    echo "  🔴 FAILED: $FAILED"
    echo "  ✅ Passed: $PASSED"
    echo "  ⏭️  Skipped: $SKIPPED"
    echo ""
    echo "  Failed Tests:"
    echo "  ─────────────"
    echo "$FAILURES" | head -50
    echo ""
    echo "  Next Steps:"
    echo "  1. Fix the failing tests above"
    echo "  2. Run 'dotnet test' to verify fixes"
    echo "  3. Check test output for root cause details"
else
    echo "  ✅ All $PASSED test(s) passed"
    if [[ "$SKIPPED" -gt 0 ]]; then
        echo "  ⏭️  $SKIPPED test(s) skipped"
    fi
fi

echo ""
echo "═══════════════════════════════════"
