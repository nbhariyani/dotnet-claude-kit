#!/usr/bin/env bash
# Post-edit hook: auto-format changed .cs files
# Runs dotnet format on specific files after Claude edits them.
#
# Usage: Called automatically by Claude Code after editing .cs files.
# Expects the edited file path as the first argument or via CLAUDE_EDITED_FILE env var.

set -euo pipefail

FILE="${1:-${CLAUDE_EDITED_FILE:-}}"

if [[ -z "$FILE" ]]; then
    exit 0
fi

# Only format C# files
if [[ "$FILE" != *.cs ]]; then
    exit 0
fi

# Skip if file doesn't exist (deleted)
if [[ ! -f "$FILE" ]]; then
    exit 0
fi

# Find the nearest .csproj or .sln to scope the format
DIR=$(dirname "$FILE")
PROJECT=""
while [[ "$DIR" != "/" && "$DIR" != "." ]]; do
    # Check for .csproj first (more specific)
    CSPROJ=$(find "$DIR" -maxdepth 1 -name "*.csproj" -print -quit 2>/dev/null || true)
    if [[ -n "$CSPROJ" ]]; then
        PROJECT="$CSPROJ"
        break
    fi
    # Check for .sln
    SLN=$(find "$DIR" -maxdepth 1 -name "*.sln" -print -quit 2>/dev/null || true)
    if [[ -n "$SLN" ]]; then
        PROJECT="$SLN"
        break
    fi
    DIR=$(dirname "$DIR")
done

if [[ -n "$PROJECT" ]]; then
    dotnet format "$PROJECT" --include "$FILE" --no-restore 2>/dev/null || true
else
    echo "No .csproj or .sln found for $FILE, skipping format"
fi
