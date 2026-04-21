---
description: >
  Systematic code cleanup pipeline for NestJS projects. 7 steps: format, imports,
  lint, dead code, TODOs, circular deps, missing await. Run before PRs or code review.
  Triggers on: /de-sloppify, "clean this up", "clean up the code", "fix code quality",
  "tidy up", "remove slop".
---

# /de-sloppify

## What

A 7-step mechanical cleanup sweep that removes noise before a code review or PR. Each
step is focused and ordered — later steps depend on earlier steps completing cleanly.
Does not change behavior; only improves code quality signals.

## When

- "clean this up"
- "de-sloppify"
- "fix code quality"
- "tidy up before review"
- "remove slop"
- Before running `/code-review` or `/verify`
- After a rapid implementation sprint that left mechanical debt

## How

Run steps in order. Report findings at each step before proceeding.

### Step 1: Format and Auto-fix

```bash
npm run lint:fix
```

Applies Prettier + ESLint auto-fixable rules. Commit the result separately if there
are many format changes — keeps the diff clean.

### Step 2: Remove Unused Imports

ESLint `no-unused-vars` and `@typescript-eslint/no-unused-imports` should have caught
these in Step 1. If any remain, remove manually. Check for:

- Unused `import type` declarations
- Barrel re-exports of deleted files

### Step 3: Fix Remaining Lint Warnings

Address lint warnings that can't be auto-fixed. Common NestJS ones:

- `@typescript-eslint/no-explicit-any` — replace `any` with a proper type
- `@typescript-eslint/explicit-function-return-type` — add return type annotation

### Step 4: Remove Dead Code

```
find_dead_code
```

Delete unused exports, providers registered in modules but never injected, and
commented-out code blocks older than the current sprint.

### Step 5: Resolve TODOs

Review all `// TODO` and `// FIXME` comments. For each:
- Fix it now if it takes less than 10 minutes
- Create a tracked issue and replace with `// TODO(#123): ...`
- Delete if it is no longer relevant

### Step 6: Break Circular Dependencies

```
detect_circular_deps
```

For each cycle found:
1. Identify the service that can be extracted to a `SharedModule`
2. Move it, update `imports[]` and `exports[]` in affected modules
3. Re-run `detect_circular_deps` to confirm resolved

### Step 7: Find Missing Await

```
detect_antipatterns
```

Look for async functions that call async methods without `await`. These are silent
fire-and-forget bugs. Fix each one.

## Example

```
Step 1: lint:fix — 14 files reformatted
Step 2: imports — 3 unused imports removed
Step 3: lint warnings — 2 any types replaced
Step 4: dead code — OldHelperService removed (0 callers)
Step 5: TODOs — 1 fixed inline, 2 ticketed, 1 deleted
Step 6: circular deps — 0 found
Step 7: missing await — 1 found in notifications.service.ts:32, fixed

De-sloppify complete. 21 total fixes.
```

## Related

- `/code-review` -- Structured review after cleanup
- `/verify` -- Full build + test + lint pipeline
