---
description: >
  Full project health check before creating a PR. Runs build, tests, lint, and
  checks for common NestJS anti-patterns. Reports pass/fail per step and auto-fixes
  what it can. Triggers on: "verify", "check everything", "before PR", "is this
  ready", "run all checks".
---

# /verify

## What

Runs the full verification suite in sequence: TypeScript build, Jest tests, ESLint,
and NestJS-specific anti-pattern checks. Reports pass/fail per step as a table.
Auto-fixes lint issues where possible.

## When

- "verify this"
- "check everything"
- "is this ready for a PR?"
- "run all checks"
- Before creating any pull request
- After a significant refactor

## How

### Step 1: TypeScript Build

```bash
npm run build
```

On failure: invoke `/build-fix` to categorize and resolve errors before continuing.

### Step 2: Test Suite

```bash
npm test -- --passWithNoTests
```

On failure: report failing test names and error messages. Do not proceed to lint
with failing tests.

### Step 3: Lint

```bash
npm run lint
```

Attempt auto-fix:

```bash
npm run lint:fix
```

Report any remaining lint errors that cannot be auto-fixed.

### Step 4: Anti-pattern Sweep

Run `detect_antipatterns` via cwm-ts-navigator. Flag:

- `console.log` in non-test files
- `synchronize: true` in TypeORM config
- Missing `@ApiProperty` on DTO fields
- Direct cross-module service imports

### Step 5: Report

Output a summary table:

| Check | Status | Notes |
|---|---|---|
| TypeScript build | PASS | — |
| Test suite | PASS | 42 tests |
| ESLint | PASS | 2 warnings auto-fixed |
| Anti-patterns | WARN | 1 console.log in orders.service.ts:14 |

Green = all PASS. Yellow = warnings only. Red = any FAIL.

## Example

```
Running verification suite...

[1/4] Build        PASS
[2/4] Tests        PASS  (38 tests, 0 skipped)
[3/4] Lint         PASS  (3 issues auto-fixed)
[4/4] Anti-patterns WARN  console.log in orders.service.ts:14

Result: YELLOW — address 1 warning before merging.
```

## Related

- `/build-fix` -- Fix TypeScript compilation errors
- `/health-check` -- Deeper project health assessment
- `/security-scan` -- Security-focused audit
