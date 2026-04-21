---
name: code-review-workflow
description: >
  Structured code review workflow for NestJS and TypeScript projects using
  ts-morph MCP tools. Multi-dimensional review covering correctness, security,
  performance, architecture compliance, and test coverage.
  Load when: "review PR", "review code", "code review", "PR review",
  "review changes", "review my code", "check code quality".
---

# Code Review Workflow

## Core Principles

1. **MCP-first analysis** - Use ts-morph MCP tools before reading source files. `detect_antipatterns`, `get_diagnostics`, and `find_references` reveal risk quickly and cheaply.
2. **Structured output** - Every review should be easy to act on: Summary, Critical, Warnings, Suggestions, Architecture, Test Coverage, and What is Good.
3. **Severity-based findings** - Keep critical issues separate from warnings and nice-to-have suggestions.
4. **Actionable comments** - Every finding should explain what is wrong, why it matters, and the shortest safe fix.
5. **Acknowledge good work** - Reinforce strong patterns so they spread across the codebase.

## Patterns

### Full PR Review Flow

Use this for non-trivial PRs: multi-file changes, new features, refactors, infra changes.

**Step 1: Understand the change scope**

- Identify added, modified, and deleted files
- Group changes by module, API boundary, persistence, auth, or infrastructure
- Flag shared files and global NestJS entry points immediately

**Step 2: Automated analysis**

Run MCP tools on changed files:

```text
-> detect_antipatterns
   Catch: missing validation decorators, unsafe any, circular module wiring,
   direct entity exposure, console logging in production paths, TypeORM sync risk

-> get_diagnostics
   Catch: TypeScript errors, decorator typing issues, unused values, wrong imports

-> get_public_api
   Check: API surface changes for controllers, exported services, shared modules
```

**Step 3: Blast radius assessment**

```text
-> find_references(symbolName: changed controller/service/export)
   Count callers and consumers.
   High fan-out = high review depth.
```

**Step 4: Architecture compliance**

```text
-> get_module_graph
   Verify module boundaries and dependency direction

-> detect_circular_deps
   Verify no import or module cycles were introduced
```

**Step 5: Test coverage check**

```text
-> get_test_coverage_map
   Check whether changed services/controllers/modules have corresponding tests
```

**Step 6: Manual review**

Read only the changed code and directly relevant neighbors for:

- Business logic correctness
- Validation and authorization coverage
- Query safety and performance
- Error handling completeness
- Naming and consistency

**Step 7: Produce the review**

```markdown
## Review Summary
[1-2 sentence assessment: scope, risk, recommendation]

## Critical
- **[file:line] [title]** - [problem]. [impact]. [fix].

## Warnings
- **[file:line] [title]** - [problem]. [impact]. [suggested fix].

## Suggestions
- **[file:line] [title]** - [better alternative]. [why].

## Architecture Compliance
[Module boundaries, exports/imports, cycles, layering]

## Test Coverage
[What has tests, what is missing, what to add]

## What's Good
- [Positive finding]
```

### Quick Review

Use for small changes such as one or two files, bug fixes, or isolated config edits.

**Steps**

1. Run `detect_antipatterns`
2. Run `get_diagnostics`
3. Read the changed code for correctness
4. Produce a short review with Summary, Issues, and What is Good

### Architecture Compliance Check

Use when the PR changes project structure, modules, shared libraries, or app bootstrap.

```text
1. get_module_graph
   -> verify imports, exports, providers, and module boundaries

2. detect_circular_deps
   -> catch cycles at file or module level

3. find_references on exported providers and shared contracts
   -> verify ownership and blast radius
```

Example checks:

| Architecture | Rule | Violation Example |
|--------------|------|-------------------|
| Feature Modules | Modules expose behavior via exports/contracts | Users module imports Orders internals directly |
| Clean Architecture | Domain/app layers stay independent of Nest infrastructure | Domain code imports `@nestjs/common` |
| DDD | Aggregates and modules communicate via contracts/events | Cross-module service reaches into another aggregate's repository |
| Modular Monolith | Modules interact through explicit seams | One module imports another module's private files |

## Anti-patterns

### Reviewing Without MCP Tools

```text
BAD:
Read every changed file manually and hope to spot issues

GOOD:
Run detect_antipatterns + get_diagnostics + module graph checks first,
then use file reads for business-logic review only.
```

### Vague Feedback

```text
BAD:
"This feels off."

GOOD:
"users.controller.ts:24 - Missing ValidationPipe coverage for create DTO.
Invalid payloads can reach service logic and produce 500s instead of 400s.
Add global or route-level validation with class-validator decorators."
```

### Missing Security Checks

```text
BAD:
"Looks clean, approved."

GOOD:
Check guard coverage, validation, secret handling, and logging exposure
before approving.
```

### Blocking on Style, Ignoring Substance

```text
BAD:
Ten comments about naming, none about a public endpoint missing auth

GOOD:
Lead with correctness, security, and architecture.
Style comes last.
```

## Decision Guide

| Scenario | Review Type | MCP Tools |
|----------|-------------|-----------|
| Feature PR (3+ files) | Full PR Review | detect_antipatterns, get_diagnostics, get_module_graph, find_references, get_test_coverage_map |
| Bug fix (1-2 files) | Quick Review | detect_antipatterns, get_diagnostics |
| Config or infra changes | Quick Review + Manual | get_diagnostics, get_module_graph |
| New module added | Architecture Compliance | get_module_graph, detect_circular_deps |
| Refactor PR | Full Review + Blast Radius | all relevant tools |
| Security-sensitive change | Full Review, escalate to security-auditor | MCP + manual security review |
| Test-only changes | Quick Review | get_diagnostics |
| Performance-critical path | Full Review, escalate to performance-analyst | get_diagnostics + targeted manual review |
