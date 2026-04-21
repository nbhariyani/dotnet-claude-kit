---
description: >
  Thorough code review using cwm-ts-navigator MCP tools. Covers TypeScript quality,
  NestJS patterns, security, and test coverage. Triggers on: "review this code",
  "code review", "check my PR", "review these changes".
---

# /code-review

## What

Performs a structured code review using cwm-ts-navigator MCP tools first, then manual
inspection. The automated first pass surfaces the highest-signal findings efficiently,
so manual review focuses on logic and architecture rather than mechanical issues.

## When

- "review this code"
- "code review"
- "check my PR"
- "review these changes"
- Before merging any non-trivial feature or fix

## How

### Step 1: Automated First Pass

Run these tools in sequence — each narrows the focus for the next:

1. `detect_antipatterns` — NestJS-specific issues: `console.log`, missing `@ApiProperty`,
   `synchronize:true`, direct cross-module service imports, missing `@Injectable`
2. `detect_circular_deps` — circular module dependencies
3. `get_diagnostics` — TypeScript compilation errors or type safety issues
4. `find_dead_code` — unused exports, providers declared but never injected
5. `get_test_coverage_map` — coverage gaps for new or modified code paths

### Step 2: Manual Inspection

After automated tools, review manually:

- **Controller thinness** — Does the controller contain business logic? It should only
  extract HTTP input and call a service method.
- **Service complexity** — Is the service doing too much? Single responsibility per method.
- **DTO completeness** — Every field has `@ApiProperty` and appropriate validation decorator.
- **Error handling** — Services throw typed `HttpException` subclasses, not `Error`.
- **Module boundaries** — Shared services exported from their module, not imported directly.

### Step 3: Report

Group findings by severity. Every finding includes file, line, and a one-line fix:

```
## Critical
- orders.module.ts:5 — synchronize:true in TypeORM config (production data-loss risk)
  Fix: remove and use migrations

## Warning
- orders.service.ts:14 — console.log (use nestjs-pino Logger)
- order-response.dto.ts:8 — missing @ApiProperty on 'status' field

## Info
- old-helper.ts:1 — dead export OldOrderHelper — safe to delete
```

## Example

```
User: /code-review

Running detect_antipatterns...  2 findings
Running detect_circular_deps... 0 cycles
Running get_diagnostics...      0 errors
Running find_dead_code...       1 unused export
Running get_test_coverage_map.. 82% coverage (2 uncovered branches)

Manual review complete.

## Critical  (0)
## Warning   (2)  — see above
## Info      (1)  — dead export
## Coverage  — orders.service.ts lines 45-52 uncovered
```

## Related

- `/de-sloppify` -- Auto-fix mechanical issues before requesting review
- `/security-scan` -- Security-focused audit
- `/verify` -- Full build + test + lint pipeline
