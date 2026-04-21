---
name: 80-20-review
description: >
  Focus code review effort on the 20% of code that causes 80% of issues.
  Prioritizes persistence, security, concurrency, integration boundaries,
  and framework wiring over formatting and style. Uses blast radius scoring
  to determine review depth. Load this skill when reviewing code, PRs,
  architecture, or when the user mentions "review", "code review",
  "PR review", "what should I review", "review priorities", "blast radius",
  or "critical path".
---

# 80/20 Review

## Core Principles

1. **Review at checkpoints, not continuously** - Review after implementation, before a PR, after integration, and around deploy. Each checkpoint answers a different risk question.
2. **Focus on persistence, security, concurrency, integration** - These areas create most production incidents. Spend review energy there before naming, formatting, or trivia.
3. **Blast radius determines depth** - A local DTO tweak gets a glance. A guard, interceptor, shared module, or migration change gets a deep review.
4. **Automate the trivial** - Formatting, import sorting, and basic static checks belong to linters, hooks, and MCP tools. Human review should focus on behavior and risk.

## Patterns

### Checkpoint Schedule

```text
CHECKPOINT 1: Post-Implementation
WHEN: After a feature or fix, before commit
FOCUS: Does it work? Does it build? Do tests pass?
CHECKLIST:
[] npm run build passes
[] npm test passes
[] get_diagnostics shows no new TypeScript errors
[] No obvious antipatterns (unsafe any, missing validation, broken module wiring)

CHECKPOINT 2: Pre-PR
WHEN: Before opening a pull request
FOCUS: Would a staff NestJS engineer approve this?
CHECKLIST:
[] Persistence: query shape, transaction safety, migration impact
[] Security: auth, input validation, secret handling, data exposure
[] Concurrency: async flow, retries, queue/idempotency behavior
[] Error handling: exceptions mapped intentionally, no swallowed failures
[] API boundary: DTOs at the edge, status codes, Swagger alignment
[] Integration: events, background jobs, external API failure handling
[] Tests: happy path + main failure path covered

CHECKPOINT 3: Post-Integration
WHEN: After merge or subsystem integration
FOCUS: Does it work with the rest of the app?
CHECKLIST:
[] Shared modules still export what consumers need
[] No circular dependencies introduced
[] Migrations or schema changes apply cleanly
[] CI pipeline still passes

CHECKPOINT 4: Deploy Readiness
WHEN: Before or just after deployment
FOCUS: Is this safe in production?
CHECKLIST:
[] Health checks pass
[] Logging is structured and avoids secrets/PII
[] Retry/timeout behavior is configured for external calls
[] Feature flags or rollback path exist for risky changes
```

### Critical Path Identification

```text
HIGH-RISK CODE (review thoroughly):
1. Persistence layer
   -> find_references for repositories, PrismaService, DataSource, QueryBuilder usage
   -> check for N+1 queries, missing pagination, transaction boundaries, raw SQL risks

2. Authentication and authorization
   -> find_implementations for guards and auth strategies
   -> verify each sensitive route has guard coverage or explicit public access

3. External integrations
   -> find_references for HttpService, queue producers, webhook handlers
   -> verify retries, timeouts, error mapping, and idempotency

4. Concurrency and background work
   -> inspect BullMQ processors, cron jobs, event handlers, shared caches
   -> verify duplicate work prevention and safe async handling

5. Cross-module boundaries
   -> get_module_graph and detect_circular_deps
   -> check imports/exports instead of direct cross-module leakage

LOW-RISK CODE (glance or skip):
- Simple DTOs
- Purely presentational Swagger decorators
- Straightforward config constants
- Test helpers with no business logic
- Formatting-only changes
```

### Blast Radius Scoring

```text
CRITICAL (30+ min):
- Global guard / interceptor / pipe / filter changes
- Authentication or authorization changes
- Database schema and migration changes
- Shared module or framework bootstrap changes
- CI/CD or deployment pipeline changes

HIGH (15-30 min):
- New module or subsystem
- Public API contract changes
- Queue consumer / event handler changes
- TypeORM or Prisma query behavior changes

MEDIUM (5-15 min):
- New feature in an existing module following established patterns
- Endpoint additions with standard DTO + validation setup
- Test additions or targeted bug fixes

LOW (glance or auto-approve):
- Documentation updates
- Formatting and import ordering
- Renaming private symbols
- Comment-only changes
```

### Batch Review Checklist

```text
TOP 10 HIGH-VALUE CHECKS:

1. AUTH GAPS
   -> Sensitive routes should not be accidentally public

2. VALIDATION GAPS
   -> Inputs should be validated before reaching service logic

3. DATA LEAKS
   -> Entities/models should not be exposed directly at the API boundary

4. QUERY RISKS
   -> Look for N+1s, unbounded list endpoints, unsafe raw SQL

5. SECRET EXPOSURE
   -> No credentials, tokens, or internal details in source or logs

6. EXCEPTION SWALLOWING
   -> Avoid broad catch blocks that hide operational failures

7. ASYNC MISUSE
   -> Missing awaits, orphaned promises, blocking work in request flow

8. MODULE BOUNDARY LEAKS
   -> Do not reach across modules without exports or contracts

9. TEST GAPS
   -> New logic should have at least one behavior-focused test

10. RESOURCE/INFRA MISCONFIGURATION
    -> Connection pools, queues, caches, and providers should be configured intentionally
```

### Review with MCP Tools

```text
REVIEW WORKFLOW WITH MCP:

1. get_module_graph -> understand where the changed code sits
2. get_diagnostics -> catch compiler/type errors quickly
3. detect_antipatterns -> surface common NestJS and TypeScript risks
4. find_dead_code -> catch leftovers from refactors
5. detect_circular_deps -> verify no new cycles
6. get_test_coverage_map -> check whether changed code has tests
```

## Anti-patterns

### Reviewing Every Trivial Change

```text
BAD:
Spending 20 minutes reviewing a pure rename across internal files

GOOD:
Trust tests, build, and static tooling for mechanical changes.
Spend that time on auth, persistence, or integration changes instead.
```

### Skipping Reviews Because "It Is Small"

```text
BAD:
"It is just one line in a global guard."

GOOD:
One line in a global guard can affect every request.
Review blast radius, not line count.
```

### Style Over Substance

```text
BAD:
Ten comments about naming while missing an unpaginated query and missing guard

GOOD:
Start with behavior, security, performance, and correctness.
Leave naming suggestions for after critical issues are addressed.
```

### Manual Review of Automatable Checks

```text
BAD:
Reviewer manually checks import order and whitespace

GOOD:
Linting, formatting, and hooks catch mechanical issues.
Reviewer focuses on logic, design, and production risk.
```

## Decision Guide

| Scenario | Review Depth | Focus Area |
|----------|--------------|------------|
| New endpoint following existing pattern | Medium | Guard coverage, validation, DTO mapping |
| Auth or guard change | Critical | Every code path, public/private access, token flow |
| Migration or schema change | Critical | Data loss risk, rollout, rollback |
| New module or subsystem | High | Architecture, exports/imports, integration points |
| Bug fix with clear root cause | Medium | Correctness and regression protection |
| Docs/formatting only | Low | Sanity check and move on |
| Query changes | High | N+1, pagination, transactions, SQL safety |
| Global interceptor/filter/pipe change | Critical | Affects every request path |
| Test additions | Low-Medium | Behavior quality over implementation coupling |
| CI/CD pipeline changes | High | Secret handling, deploy safety, rollback |
