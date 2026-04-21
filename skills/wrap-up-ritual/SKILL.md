---
name: wrap-up-ritual
description: >
  Structured session ending ritual that captures completed work, pending tasks,
  and learnings before a session ends. Writes a handoff note to .claude/handoff.md
  so the next session can pick up exactly where this one left off.
---

# Wrap-Up Ritual

## Core Principles

1. **Sessions are ephemeral, knowledge is not** - Preserve the state before the conversation ends.
2. **Three captures every time** - Record what was done, what is pending, and what was learned.
3. **Write the handoff for a stranger** - Assume the next session has no context.
4. **Use one handoff file** - Keep the current handoff in `.claude/handoff.md`.
5. **Move durable learnings into memory** - Handoff notes are temporary; project rules belong elsewhere.

## Patterns

### Session Summary Template

```markdown
# Session Handoff

> Generated: 2026-04-21 | Branch: feature/orders

## Completed
- [x] Added order creation DTO validation
  - Files: `src/orders/dto/create-order.dto.ts`, `src/main.ts`
- [x] Fixed provider export in orders.module.ts

## Pending
- [ ] Add e2e coverage for order creation
- [ ] Re-run full test suite after auth module changes land

## Learned
- This project relies on global validation, not per-route validation setup
- Shared services must be exported from their owning module before downstream imports work

## Context
- Working branch: `feature/orders`
- Uncommitted changes: yes/no
- Last meaningful command/test result: [short summary]
```

### Trigger Detection

Wrap-up signals include:

- "Let's wrap up"
- "That's all for now"
- "Save progress"
- "End of session"
- "Let's stop here"

When detected, offer to write the handoff.

### Learning Extraction at Session End

Before writing the handoff, ask:

```text
1. Did the user correct anything?
2. Did we discover something non-obvious?
3. Did we make an important decision with rationale?
4. Did a tool or approach fail in a memorable way?
5. Did we uncover a reusable pattern?
```

Good learnings are specific and reusable.
Bad learnings are vague, obvious, or already captured as permanent rules.

## Anti-patterns

### Abrupt Endings

```text
BAD:
Session ends with no handoff

GOOD:
Write a concise handoff so the next session resumes quickly
```

### Vague Handoffs

```text
BAD:
"Worked on the Orders module"

GOOD:
"Added order validation in create-order DTO and enabled global validation in main.ts"
```

### Accumulating Many Handoff Files

```text
BAD:
handoff-1.md, handoff-2.md, handoff-final.md

GOOD:
One current handoff file, overwritten each session
```

### Skipping the Learning Extraction

```text
BAD:
Capture tasks only and lose the discovery behind them

GOOD:
Record the insight that would save the next session time
```

## Decision Guide

| Scenario | Action |
|----------|--------|
| User says "wrap up" or equivalent | Write `.claude/handoff.md` |
| Multiple tasks completed | List each clearly |
| Session had user corrections | Capture durable ones in memory too |
| Different developer may continue | Add rationale and clear next steps |
| No pending work | Still document completed work and learnings |
| Previous handoff exists | Overwrite with current state unless asked otherwise |
| Session ended with failing tests | Record which tests failed and why they matter |
| User does not want a handoff | Respect it, but still suggest saving durable learnings |
