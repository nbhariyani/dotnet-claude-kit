#!/usr/bin/env bash
# Analyze Jest test output for coverage gaps and failures.
# Called after test runs with the test output file path as $1.
set -euo pipefail

OUTPUT_FILE="${1:-}"

if [ -z "$OUTPUT_FILE" ] || [ ! -f "$OUTPUT_FILE" ]; then
  exit 0
fi

echo "=== Test Analysis ==="

# Count failures
FAILURES=$(grep -c "FAIL " "$OUTPUT_FILE" 2>/dev/null || echo "0")
PASSES=$(grep -c "PASS " "$OUTPUT_FILE" 2>/dev/null || echo "0")

echo "Passed: $PASSES | Failed: $FAILURES"

# Surface coverage thresholds if present
if grep -q "Coverage summary" "$OUTPUT_FILE" 2>/dev/null; then
  echo "--- Coverage ---"
  grep -A 10 "Coverage summary" "$OUTPUT_FILE" | head -12
fi

# Surface uncovered lines
if grep -q "Uncovered Line" "$OUTPUT_FILE" 2>/dev/null; then
  echo "--- Uncovered Lines ---"
  grep "Uncovered Line" "$OUTPUT_FILE" | head -10
fi

# Surface any test names that failed
if grep -q "● " "$OUTPUT_FILE" 2>/dev/null; then
  echo "--- Failing Tests ---"
  grep "● " "$OUTPUT_FILE" | head -10
fi

exit 0
