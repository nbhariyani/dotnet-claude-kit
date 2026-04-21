---
name: split-memory
description: >
  Modular CLAUDE.md management strategy for projects that outgrow a single
  instruction file. Covers when and how to split a monolithic CLAUDE.md into
  multiple files, organizing by concern, module, or team. Includes precedence
  rules to prevent conflicting instructions.
---

# Split Memory: Modular CLAUDE.md Strategy

## Core Principles

1. **Start monolithic, split when it hurts** - A single CLAUDE.md is simpler until it becomes hard to navigate.
2. **Root CLAUDE.md is the index** - After splitting, the root file should be a concise map plus universal rules.
3. **Keep discovery obvious** - Place supporting files where Claude and humans can find them consistently.
4. **Avoid conflicting instructions** - Each topic should have one clear owner.
5. **Split by one axis at a time** - By concern, by module, or by team. Mixing axes increases overlap and conflict.

## Patterns

### Pattern 1: Single File

```text
project-root/
|-- CLAUDE.md
|-- src/
|-- test/
```

Use this while the file is still easy to search and maintain.

### Pattern 2: Split by Concern

```text
project-root/
|-- CLAUDE.md
|-- .claude/
    |-- instructions/
        |-- architecture.md
        |-- coding-standards.md
        |-- testing.md
        |-- api-design.md
        |-- persistence.md
        |-- deployment.md
```

Example root index:

```markdown
# Project Instructions

## Universal Rules
- Use strict TypeScript and keep module boundaries explicit
- Prefer ConfigService over ad hoc environment access
- Controllers return DTOs, not ORM entities

## Detailed Instructions
- architecture.md - project structure and boundaries
- coding-standards.md - naming, formatting, style
- testing.md - Jest/SuperTest strategy
- api-design.md - controllers, DTOs, versioning, auth
- persistence.md - ORM, migrations, query safety
- deployment.md - CI/CD and environment setup
```

### Pattern 3: Split by Module

```text
project-root/
|-- CLAUDE.md
|-- src/
    |-- orders/
    |   |-- CLAUDE.md
    |-- catalog/
    |   |-- CLAUDE.md
    |-- auth/
        |-- CLAUDE.md
```

Use this when modules have distinct domain rules or integration expectations.

### Pattern 4: Split by Team

Use `.claude/teams/` only when different teams genuinely need distinct guidance and shared rules remain in root.

### Pattern 5: Conditional Loading

Have the root file map task domains to detailed instruction files, while keeping universal rules always visible.

### Precedence Rules

```text
HIGHEST:
1. Root CLAUDE.md
2. Concern-specific instruction files
3. Module-level CLAUDE.md
LOWEST:
4. Team-level files

If two files define the same topic differently, fix the overlap instead of tolerating it.
```

## Anti-patterns

### Premature Splitting

Do not fragment a short, healthy CLAUDE.md just because modularization sounds cleaner.

### Conflicting Cross-File Instructions

```text
BAD:
Two files both define API response rules differently

GOOD:
One owner per topic
```

### Split Without an Index

```text
BAD:
Many instruction files, no map

GOOD:
Root CLAUDE.md explains where each rule set lives
```

### Mixing Split Axes

```text
BAD:
Split by concern and by module at the same time with overlapping content

GOOD:
Choose the axis that best matches how the project is actually organized
```

## Decision Guide

| Scenario | Recommendation |
|----------|----------------|
| CLAUDE.md still easy to use | Keep one file |
| CLAUDE.md is too long for one team | Split by concern |
| Modules have distinct domain rules | Split by module |
| Different teams need different instructions | Split by team |
| Files contradict each other | Fix ownership and precedence immediately |
| New module added | Add module-level guidance only if it has unique rules |
