---
name: self-correction-loop
description: >
  Self-improving correction capture system. After any user correction, detect
  it, generalize the lesson, and store it as a reusable rule in MEMORY.md.
  Ensures repeated mistakes turn into project knowledge instead of repeating
  across sessions.
---

# Self-Correction Loop

## Core Principles

1. **Every correction is useful signal** - A quick correction from the user can prevent many repeated mistakes later.
2. **Generalize before storing** - Convert one-off phrasing into a reusable project rule whenever possible.
3. **Categorize for retrieval** - Store rules where they can actually be found and reused.
4. **Deduplicate aggressively** - Update an existing rule instead of creating near-duplicates.
5. **Review memory at session start** - Memory only matters if it is consulted before new work begins.

## Patterns

### Correction Detection and Capture Flow

```text
1. DETECT
   User says:
   - "No, use X instead of Y"
   - "We do not do it that way here"
   - "Remember this"
   - "Always/never do X in this project"

2. ACKNOWLEDGE
   Confirm the correction clearly.

3. GENERALIZE
   Turn the specific correction into a broader reusable rule.

4. CHECK
   Search MEMORY.md for overlap or contradiction.

5. STORE
   Add or update the rule in the right category.

6. CONFIRM
   Tell the user what was captured.
```

### MEMORY.md Organization

```markdown
# Project Memory

## Architecture
- Feature modules own their DTOs and services locally unless explicitly shared

## Configuration
- Use ConfigService, not direct `process.env`, in application code

## API Design
- Controllers return DTOs, not ORM entities

## Testing
- Prefer Jest + SuperTest for HTTP flows
```

Suggested categories:

- Architecture
- Naming
- API Design
- Persistence
- Testing
- Configuration
- Performance
- Security

### Rule Generalization

Example:

```text
SPECIFIC:
"Do not import from another module's private service file"

GENERALIZED:
"Modules communicate through exports or shared contracts, not private cross-module imports"
```

Another example:

```text
SPECIFIC:
"Use ConfigService here, not process.env"

GENERALIZED:
"Use ConfigService instead of direct process.env access in NestJS application code"
```

### Periodic Memory Audit

Review memory periodically to:

- remove contradictions
- merge overlapping rules
- delete stale rules
- keep categories balanced and readable

### Session-Start Memory Review

At the start of a session, check memory for rules relevant to the likely task before generating code.

## Anti-patterns

### Ignoring Corrections

```text
BAD:
Fix the immediate issue but do not capture the rule

GOOD:
Fix it and store the reusable lesson
```

### Overly Specific Rules

```text
BAD:
"In orders.controller.ts line 44, use ConfigService"

GOOD:
"Use ConfigService instead of direct process.env access in app code"
```

### Never Reviewing Memory

```text
BAD:
MEMORY.md grows but is never consulted

GOOD:
Review relevant memory at session start and before major edits
```

### Storing Temporary Session State as Permanent Memory

```text
BAD:
"Currently working in orders.module.ts"

GOOD:
"Orders follows feature-module structure with local DTOs"
```

## Decision Guide

| Scenario | Action |
|----------|--------|
| User explicitly corrects Claude | Capture a generalized rule |
| User says "remember this" | Store it, generalized if possible |
| Same correction appears twice | Treat as high-priority memory |
| Rule is project-specific | Store in project memory |
| Rule is temporary or one-off | Do not store it |
| Memory grows too large | Audit, merge, prune |
| Starting a new session | Review relevant memory first |
| User asks to forget a rule | Remove it immediately |
