---
name: learning-log
description: >
  Auto-document insights and discoveries during development sessions. Unlike
  MEMORY.md, which stores corrective rules, the learning log captures organic
  discoveries: non-obvious bugs, undocumented architecture decisions,
  performance findings, workarounds, and gotchas. Stored at
  .claude/learning-log.md.
---

# Learning Log

## Core Principles

1. **Log insights, not rules** - Rules tell Claude what to do. The learning log explains what was discovered and why it matters.
2. **Structure enables searchability** - Use a consistent entry shape so findings are easy to scan later.
3. **Log during work, not after** - A short note captured immediately beats a perfect note written from memory later.
4. **Periodic review extracts patterns** - Repeated discoveries usually indicate a systemic issue or a rule worth promoting.
5. **Distinct from handoff notes** - Handoffs capture session state; the learning log captures reusable insight.

## Patterns

### Log Entry Format

```markdown
# Learning Log

## 2026-04-21 | Bug Root Cause | Provider Export Missing Across Module Boundary
The service was registered correctly but never exported, so downstream modules failed only at runtime.
**Files:** `src/orders/orders.module.ts`, `src/payments/payments.module.ts`
**Resolution:** Export the provider from its owning module and import only the module, not private files.

## 2026-04-20 | Gotcha | Validation Decorators Were Present but Global Validation Was Disabled
DTO decorators existed, but invalid payloads still reached services because the global ValidationPipe was not enabled.
**Files:** `src/main.ts`, `src/users/dto/create-user.dto.ts`
**Resolution:** Enable a global ValidationPipe and keep DTO validation declarative.
```

### Auto-Logging Triggers

```text
TRIGGER 1: Non-obvious bug root cause
TRIGGER 2: Undocumented architecture decision
TRIGGER 3: Workaround for framework/library limitation
TRIGGER 4: Performance finding
TRIGGER 5: External service behavior mismatch
TRIGGER 6: Surprising configuration effect
```

### Category System

Use these categories consistently:

```text
Architecture Decision
Bug Root Cause
Performance Discovery
Pattern Found
Gotcha
External Service
```

### Practical Logging Workflow

```text
1. Notice something non-obvious
2. Capture a short entry immediately
3. Include category, title, and affected files
4. Expand later only if needed
```

### Log vs Memory vs Handoff

```text
MEMORY.md
- prescriptive rules
- durable team/project guidance

.claude/learning-log.md
- descriptive insights
- discoveries and explanations

.claude/handoff.md
- current session state
- completed, pending, next steps
```

## Anti-patterns

### Logging Everything

```text
BAD:
Log routine, obvious edits with no learning value

GOOD:
Log only surprises, discoveries, and reusable insight
```

### No Categorization

```text
BAD:
Entries have no category, so the log becomes hard to search

GOOD:
Categorize every entry consistently
```

### Write-Only Log

```text
BAD:
Keep adding entries but never review for patterns

GOOD:
Review periodically and promote repeated learnings into rules when appropriate
```

### Duplicating MEMORY.md

```text
BAD:
Repeat a permanent rule as a vague log entry

GOOD:
Log the concrete incident or discovery behind the rule
```

## Decision Guide

| Scenario | Action |
|----------|--------|
| Found a non-obvious bug root cause | Log it |
| Discovered why code is structured a certain way | Log it |
| Framework behaved unexpectedly | Log it |
| Performance surprise | Log it |
| External API behaved differently than docs | Log it |
| User corrected Claude's code | Use memory, not the learning log |
| Routine code change with no insight | Do not log it |
| Same issue appears repeatedly | Promote the lesson into a rule |
