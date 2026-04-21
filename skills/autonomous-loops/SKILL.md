---
name: autonomous-loops
description: >
  Autonomous iteration loops for NestJS and TypeScript development: build-fix,
  test-fix, refactor, and scaffold loops. Each loop has bounded iterations,
  progress detection, and fail-safe guards that prevent infinite retries and
  wasted tokens. Load this skill when Claude needs to fix build errors, fix
  failing tests, perform multi-step refactoring, scaffold a new feature, or
  when the user says "fix the build", "make the tests pass", "refactor this",
  "scaffold", "generate and verify", "keep going until it works", "autonomous",
  or "loop".
---

# Autonomous Loops

## Core Principles

1. **Bounded iteration, always** - Every loop has a maximum iteration count. Default is 5, hard cap is 10. If 5 iterations cannot solve a build or test failure, the problem needs a different approach, not more repetition.
2. **Progress tracking or exit** - Each iteration must make measurable progress: fewer TypeScript errors, fewer failing tests, fewer warnings, or advancement to the next verification phase.
3. **Fail-safe guards are non-negotiable** - Exit on max iterations reached, no progress detected, critical infrastructure failure, or a fix introducing more breakage than it removes.
4. **Transparency at every iteration** - Report what changed and why after each iteration. The user should be able to follow the loop without reading every modified file.
5. **Atomicity per iteration** - Each iteration should leave the codebase in a valid or improved state. Do not leave half-finished changes that depend on a later iteration succeeding.

## Patterns

### Build-Fix Loop

The most common loop. Fix TypeScript and NestJS build errors until the project passes verification.

```text
BUILD-FIX LOOP:
  max_iterations = 5
  previous_errors = []

  for iteration in 1..max_iterations:
    diagnostics = get_diagnostics(project)

    if diagnostics.error_count == 0:
      result = npm run build
      if result.exit_code == 0:
        report "BUILD PASS after {iteration} iteration(s)"
        return PASS

    errors = normalize(diagnostics.errors or parse_errors(build_output))

    if errors == previous_errors:
      report "STUCK - same {len(errors)} error(s) after fix attempt"
      return STUCK

    if iteration > 1 and len(errors) > len(previous_errors):
      report "REGRESSING - {len(errors)} errors, up from {len(previous_errors)}"
      return REGRESSION

    report "Iteration {iteration}: {len(errors)} error(s) found"
    for error in errors:
      fix = determine_fix(error)
      apply(fix)
      report "  Fixed {error.code}: {fix.description}"

    previous_errors = errors

  report "MAX ITERATIONS reached with {len(errors)} error(s) remaining"
  return FAIL
```

**Common error categories**

```text
CATEGORY                  EXAMPLE          FIX STRATEGY
Missing import            TS2304/TS2307    Add correct import or fix path alias
Type mismatch             TS2322           Align DTO/entity/service return types
Missing property          TS2339           Fix wrong shape, mapper, or contract
Wrong method signature    TS2554/TS2559    Update call site to current API
Decorator metadata issue  Nest runtime     Fix module wiring, provider export, DTO decorator
Config typing issue       TS2345           Validate env parsing and ConfigService usage
Unused symbol             TS6133           Remove dead code or use the value intentionally
Null/undefined issue      TS2532/TS18048   Add guard, narrow type, or make contract explicit
Syntax error              TS1005           Fix syntax before chasing downstream errors
```

### Test-Fix Loop

Fix failing tests iteratively. Always decide whether the bug is in the test, the setup, or the production code.

```text
TEST-FIX LOOP:
  max_iterations = 5
  previous_failures = []

  for iteration in 1..max_iterations:
    result = npm test -- --runInBand

    if result.all_passed:
      report "TESTS PASS after {iteration} iteration(s)"
      return PASS

    failures = parse_failures(result.output)

    if failures == previous_failures:
      report "STUCK - same {len(failures)} failure(s) after fix attempt"
      return STUCK

    report "Iteration {iteration}: {len(failures)} failure(s)"
    for failure in failures:
      diagnosis = diagnose(failure)
      report "  {failure.test_name}: {diagnosis.root_cause}"

      if diagnosis.fix_in == "test":
        apply(fix_test(failure, diagnosis))
      else:
        apply(fix_production_code(failure, diagnosis))

    previous_failures = failures

  report "MAX ITERATIONS with {len(failures)} failure(s) remaining"
  return FAIL
```

**Diagnosis protocol**

```text
1. Read the failing test and understand the assertion.
2. Read only the production code needed to understand the behavior.
3. Decide the root cause:
   a. Test expectation is wrong
   b. Production code is wrong
   c. Test setup/module wiring is incomplete
   d. Contract changed and test needs an intentional update
4. Never weaken assertions just to get green tests.
```

### Refactor Loop

Multi-step refactoring with verification after each target.

```text
REFACTOR LOOP:
  targets = identify_refactoring_targets()
  max_iterations = min(len(targets), 10)

  for iteration, target in enumerate(targets, 1):
    report "Refactoring {iteration}/{len(targets)}: {target.description}"
    apply_refactoring(target)

    build_result = build_fix_loop(max_iterations=3)
    if build_result != PASS:
      report "Build failed after refactoring {target}. Stop and reassess."
      return FAIL

    test_result = test_fix_loop(max_iterations=3)
    if test_result != PASS:
      report "Tests failed after refactoring {target}. Stop and reassess."
      return FAIL

    diagnostics = get_diagnostics(project)
    if diagnostics.new_errors > 0:
      report "New diagnostics introduced. Fixing before continuing."
      return FAIL

  return PASS
```

### Scaffold Loop

Generate a new NestJS feature end-to-end and verify it integrates cleanly.

```text
SCAFFOLD LOOP:
  1. GENERATE source files
     -> Create module, controller, service, DTOs, pipes/guards/interceptors as needed
     -> Wire imports/exports in the correct NestJS module
     -> Add ORM artifacts if the feature touches persistence

  2. BUILD VERIFICATION
     -> Run get_diagnostics first
     -> Run build-fix loop (max 5 iterations)

  3. GENERATE tests
     -> Create unit tests for service logic
     -> Create controller/e2e tests with Jest + SuperTest if the project uses them
     -> Match the repo's testing conventions

  4. TEST VERIFICATION
     -> Run test-fix loop (max 5 iterations)

  5. QUALITY CHECK
     -> get_diagnostics: zero new errors
     -> detect_antipatterns: zero new critical antipatterns
     -> detect_circular_deps: no new cycles
     -> Verify naming and folder placement match project conventions
```

### Progress Detection

```text
PROGRESS METRICS:
  Build-Fix:    error_count[N] < error_count[N-1]
  Test-Fix:     failure_count[N] < failure_count[N-1]
  Refactor:     remaining_targets[N] < remaining_targets[N-1]
  Scaffold:     phase advances from generate -> build -> test -> verify

STUCK DETECTION:
  Same diagnostics after a fix attempt -> STUCK
  Same failing tests after a fix attempt -> STUCK
  Errors oscillate without net improvement -> STUCK
  Fix introduces new failures in previously healthy code -> REGRESSION
```

### Emergency Exit Conditions

```text
EMERGENCY EXITS:
  1. More errors than before
     -> Stop and report regression

  2. Critical environment failure
     -> Missing package manager, broken tsconfig, test runner crash, DB container unavailable

  3. Cascading failures
     -> One fix repeatedly creates several new failures

  4. Infrastructure failure
     -> Jest cannot boot, Nest testing module cannot compile, migrations cannot connect

  5. User interruption
     -> Finish the current small unit of work, report status, and wait
```

### Loop Nesting and Reporting

```text
NESTING RULES:
  - Nested loops get a smaller budget (parent 5 -> child 3)
  - Maximum nesting depth: 2
  - Nested loop failure means the parent loop pauses and reports
  - Total iteration budget across nested loops should stay bounded

REPORT FORMAT:
  [Loop Type] Iteration {N}/{MAX}: {count}
  -> {file}: {what changed and why}
  -> Result: {new count} | Status: {CONTINUE/PASS/STUCK/FAIL}
```

## Anti-patterns

### Unbounded Loops

```text
BAD:
"Keep fixing build errors until it compiles"

GOOD:
build_fix_loop(max_iterations=5)
```

### Retrying the Same Fix

```text
BAD:
Iteration 1: add an import -> TS2307 persists
Iteration 2: add the same import -> TS2307 persists

GOOD:
Iteration 1: add import -> TS2307 persists
Iteration 2: STUCK - same error after fix.
  "The symbol may come from a different module, alias, or package export."
```

### Fixing by Deletion

```text
BAD:
Error: provider not found
Fix: delete the guard/interceptor/module wiring

GOOD:
Error: provider not found
Fix: register the provider in the module or export it from the owning module
```

### Silent Loops

```text
BAD:
...silence...
"Done! Fixed 7 issues."

GOOD:
"Iteration 1/5: 4 diagnostics found
  Fixed users.service.ts -> aligned return type with DTO
  Fixed users.module.ts -> exported provider needed by auth module
  2 diagnostics remain."
```

### Over-Aggressive Test Fixing

```text
BAD:
expect(response.status).toBe(201) -> changed to expect(response).toBeDefined()

GOOD:
expect(response.status).toBe(201)
-> Diagnosis: controller route not registered in testing module
-> Fix: import the correct Nest module and keep the original assertion
```

## Decision Guide

| Scenario | Loop Type | Max Iterations | Notes |
|----------|-----------|----------------|-------|
| TypeScript build fails after changes | Build-Fix | 5 | Prefer `get_diagnostics` before `npm run build` |
| Tests fail after code changes | Test-Fix | 5 | Diagnose test vs production bug first |
| Tests fail after build-fix loop | Test-Fix | 3 | Smaller budget after build stabilization |
| Multi-file refactoring | Refactor | 10 | Verify build and tests after each target |
| Generating a new feature | Scaffold | Phase-based | Build-fix and test-fix nested inside |
| Same error persists after fix | Exit with STUCK | N/A | Report and recommend investigation |
| Fix introduces more errors | Emergency exit | N/A | Stop and reassess |
| User says "keep going" | Extend by 3 | Current + 3 | Never exceed 10 |
| User says "stop" | Exit immediately | N/A | Preserve current state and report progress |
