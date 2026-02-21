#!/usr/bin/env bash
# Pre-build hook: validate project structure matches expected architecture
# Checks that expected project folders exist and naming conventions are followed.
#
# Usage: Run before dotnet build to catch structural issues early.
# Expects to be run from the solution root directory.

set -euo pipefail

SOLUTION_DIR="${1:-.}"
ERRORS=0
WARNINGS=0

echo "Validating project structure..."

# Check for solution file
SLN_COUNT=$(find "$SOLUTION_DIR" -maxdepth 1 -name "*.sln" -o -name "*.slnx" 2>/dev/null | wc -l)
if [[ "$SLN_COUNT" -eq 0 ]]; then
    echo "⚠️  No .sln or .slnx file found in $SOLUTION_DIR"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for Directory.Build.props (recommended for multi-project solutions)
CSPROJ_COUNT=$(find "$SOLUTION_DIR" -name "*.csproj" 2>/dev/null | wc -l)
if [[ "$CSPROJ_COUNT" -gt 2 ]]; then
    if [[ ! -f "$SOLUTION_DIR/Directory.Build.props" ]]; then
        echo "⚠️  Multi-project solution without Directory.Build.props — consider centralizing common settings"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Check for global.json (recommended for SDK version pinning)
if [[ ! -f "$SOLUTION_DIR/global.json" ]]; then
    echo "⚠️  No global.json found — consider pinning the SDK version"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for .editorconfig (recommended for code style consistency)
if [[ ! -f "$SOLUTION_DIR/.editorconfig" ]]; then
    echo "⚠️  No .editorconfig found — consider adding for consistent code style"
    WARNINGS=$((WARNINGS + 1))
fi

# Check that test projects exist
TEST_PROJECTS=$(find "$SOLUTION_DIR" -name "*.Tests.csproj" -o -name "*.Test.csproj" -o -name "*Tests.csproj" 2>/dev/null | wc -l)
if [[ "$TEST_PROJECTS" -eq 0 && "$CSPROJ_COUNT" -gt 1 ]]; then
    echo "⚠️  No test projects found — consider adding tests"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for mixed target frameworks
if [[ "$CSPROJ_COUNT" -gt 0 ]]; then
    FRAMEWORKS=$(grep -h '<TargetFramework>' "$SOLUTION_DIR"/*/*.csproj "$SOLUTION_DIR"/src/*/*.csproj 2>/dev/null | sort -u | wc -l || echo "0")
    if [[ "$FRAMEWORKS" -gt 1 ]]; then
        echo "⚠️  Mixed target frameworks detected — consider aligning all projects"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "🔴 $ERRORS error(s) found — fix before building"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    echo "⚠️  $WARNINGS warning(s) — consider addressing these"
    exit 0
else
    echo "✓ Project structure looks good"
    exit 0
fi
