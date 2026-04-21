---
description: >
  Overall project health assessment for NestJS codebases. Checks TypeScript errors,
  anti-patterns, circular dependencies, test coverage, and security vulnerabilities.
  Reports a green/yellow/red health score per category. Triggers on: "health check",
  "how is this codebase", "audit this project", "what's wrong with this code".
---

# /health-check

## What

Assesses overall project health across five dimensions using cwm-ts-navigator MCP tools
plus `npm audit`. Produces a health dashboard with a color-coded score per category.
Identifies the highest-priority issues to address first.

## When

- "health check"
- "how is this codebase"
- "audit this project"
- "what's wrong with this code"
- Onboarding to an unfamiliar codebase
- After inheriting a legacy NestJS project

## How

### Step 1: TypeScript Health

```
get_diagnostics
```

Green = 0 errors. Yellow = warnings only. Red = any type errors.

### Step 2: Anti-Pattern Count

```
detect_antipatterns
```

Green = 0. Yellow = 1-5. Red = 6+. Flag critical ones (synchronize:true) immediately
regardless of count.

### Step 3: Module Dependency Health

```
detect_circular_deps
```

Green = 0 cycles. Yellow = 1-2 cycles. Red = 3+ or cycles involving core modules.

### Step 4: Test Coverage

```
get_test_coverage_map
```

Green = 80%+. Yellow = 60-80%. Red = below 60%.

### Step 5: Security Vulnerabilities

```bash
npm audit --audit-level=high
```

Green = 0 high/critical CVEs. Yellow = moderate only. Red = any high or critical.

### Step 6: Report Dashboard

```
## Project Health: YELLOW

| Category         | Score  | Detail                                      |
|------------------|--------|---------------------------------------------|
| TypeScript       | GREEN  | 0 errors                                    |
| Anti-patterns    | YELLOW | 4 findings (no critical)                    |
| Module graph     | GREEN  | 0 circular deps                             |
| Test coverage    | YELLOW | 71% overall                                 |
| Security         | GREEN  | 0 high CVEs (2 moderate)                    |

Top priorities:
1. Fix 4 anti-patterns (run /de-sloppify)
2. Add coverage to orders.service.ts (lines 45-80)
```

## Example

```
User: /health-check

Analyzing project...

TypeScript  GREEN   0 errors
Anti-patterns YELLOW 3 findings
Circular deps GREEN  0 cycles
Coverage    RED     54% — below threshold
Security    GREEN   0 high CVEs

Overall: RED (coverage below 60%)

Recommended next: /tdd to add tests for uncovered service methods.
```

## Related

- `/verify` -- Pre-PR check (build + test + lint)
- `/code-review` -- Detailed code review after health check
- `/security-scan` -- Deep security audit
