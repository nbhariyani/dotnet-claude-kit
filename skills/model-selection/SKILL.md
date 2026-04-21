---
name: model-selection
description: >
  Strategic Claude model selection for modern software workflows. Guides when
  to use a heavier reasoning model for ambiguous design work versus a faster,
  cheaper model for routine implementation or subagent tasks. Covers switching
  workflows, subagent assignment, and cost-aware task routing.
---

# Model Selection

## Core Principles

1. **Match model to complexity, not size** - A large but repetitive refactor is often a fast-model task; a small but ambiguous design decision is not.
2. **Use the fast workhorse for routine implementation** - Established patterns, straightforward bug fixes, testing, and mechanical edits rarely need the heaviest model.
3. **Use the strongest reasoner for trade-off-heavy decisions** - Architecture choices, subtle debugging, and incomplete requirements benefit from deeper reasoning.
4. **Context window is still a budget** - A bigger context window does not justify loading everything.
5. **Use light subagents for bounded helper tasks** - Simple lookups, summaries, and command/result triage are usually ideal for smaller models.

## Patterns

### Task Complexity Assessment

```text
ROUTINE TASKS -> fast workhorse model
- implement a feature following an existing pattern
- write tests for existing code
- fix a bug with a clear error trail
- scaffold or update standard files
- lint, format, or resolve ordinary build issues

COMPLEX TASKS -> deep reasoning model
- choose between architecture approaches
- debug a subtle issue with unclear cause
- review design trade-offs and long-term impact
- untangle complex dependency problems
- produce or evaluate migration strategy

SIMPLE SUBTASKS -> lightweight subagent model
- locate files or symbols
- run tests and summarize failures
- search for patterns across files
- summarize a module or config
```

### Switching Workflow

Use a strong planner, a fast implementer, and a strong reviewer when the task justifies it:

```text
PHASE 1: PLAN
  -> analyze constraints, trade-offs, and acceptance criteria

PHASE 2: EXECUTE
  -> implement, verify, and handle routine issues quickly

PHASE 3: REVIEW
  -> inspect subtle risks, architecture drift, and edge cases
```

### Subagent Assignment

```text
SUBAGENT: "Find auth-related modules and summarize their roles"
-> lightweight model

SUBAGENT: "Run npm test and summarize failures"
-> lightweight model

SUBAGENT: "Analyze dependency cycles and propose likely fixes"
-> fast workhorse or stronger, depending on complexity

SUBAGENT: "Review this design for architectural and security issues"
-> deep reasoning model
```

## Anti-patterns

### Using the Strongest Model for Routine Work

```text
BAD:
Use the most expensive model to replicate an established CRUD pattern

GOOD:
Use the faster model when the work is clear and repetitive
```

### Using a Fast Model for Deep Architecture Decisions

```text
BAD:
Make an important architecture choice with minimal reasoning

GOOD:
Use the stronger model when the task is mostly about trade-offs and ambiguity
```

### Same Model for Every Subagent

```text
BAD:
All subagents use the strongest model, even for search and command summaries

GOOD:
Use lightweight models for bounded helper work and reserve stronger models for reasoning-heavy tasks
```

## Decision Guide

| Scenario | Recommendation |
|----------|----------------|
| Plan a new module or subsystem | Deep reasoning model |
| Implement a feature with an established pattern | Fast workhorse model |
| Debug a subtle intermittent issue | Deep reasoning model |
| Fix a straightforward build error | Fast workhorse model |
| Write tests for existing code | Fast workhorse model |
| Review architecture or high-risk design | Deep reasoning model |
| Subagent: file lookup or search | Lightweight model |
| Subagent: summarize test output | Lightweight model |
| Subagent: dependency analysis | Mid/high model depending on complexity |
