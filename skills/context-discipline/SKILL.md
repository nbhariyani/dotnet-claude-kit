---
name: context-discipline
description: >
  Token budget management for Claude Code sessions. Teaches how to minimize
  context consumption using MCP-first navigation, lazy loading, subagent
  isolation, and strategic file reading. Keeps Claude effective throughout
  long sessions by treating the context window as a budget, not a dumping
  ground. Load this skill when context is running low, sessions feel sluggish,
  Claude starts forgetting earlier details, or when planning how to explore
  a large codebase efficiently.
---

# Context Discipline

## Core Principles

1. **MCP tools first, file reads second** - A ts-morph MCP query is usually far cheaper than reading entire files. Use MCP for discovery and file reads for implementation.
2. **Lazy load everything** - Do not read files, skills, or directories "just in case." Load information when it is needed.
3. **Subagents are context isolation chambers** - Use them to explore or summarize large areas so the main thread stays focused.
4. **Summarize and discard** - Keep conclusions in context, not raw file dumps.
5. **Know your budget** - Large windows still fill quickly in real repositories. Plan reads intentionally.

## Patterns

### MCP-First Navigation

```text
TASK: Understand how UsersService works

EXPENSIVE APPROACH:
1. Read users.service.ts
2. Read users.module.ts
3. Read users.repository.ts
4. Read user.entity.ts

TOKEN-EFFICIENT APPROACH:
1. find_symbol "UsersService"
2. get_public_api "UsersService"
3. find_references "UsersService"
4. get_dependency_graph for the file or module

Only then read the exact file and method you plan to modify.
```

### Subagent Offloading Decision Matrix

```text
USE A SUBAGENT WHEN:
- Exploring an unfamiliar subsystem that would require reading many files
- Comparing multiple approaches
- Running analysis that returns verbose results
- Tracing a cross-cutting concern such as auth, logging, or queue processing

STAY IN MAIN CONTEXT WHEN:
- You are modifying files already loaded
- You only need a couple of MCP lookups
- The task depends heavily on the live user conversation
```

### Context Budget Planning

```text
UNDERSTAND: use MCP and summaries first
PLAN: keep the plan short and tied to files/modules
IMPLEMENT: read only files you will edit
VERIFY: prefer diagnostics, focused tests, and targeted command output
```

### File Reading Prioritization

```text
PRIORITY 1 - Files you will modify
Read them fully.

PRIORITY 2 - Contracts you must satisfy
Read interfaces, DTOs, exported provider signatures, module definitions.

PRIORITY 3 - Reference patterns
Use get_public_api or subagent summaries first.

PRIORITY 4 - General context
Prefer subagent summaries or module graphs.

NEVER READ FIRST:
- Entire directories to "understand the project"
- All tests for context
- Generated artifacts or lockfiles unless directly relevant
```

### Large Codebase Strategy

```text
LARGE REPO APPROACH:
1. get_module_graph
2. identify the 2-3 relevant modules
3. find_symbol for key classes/functions
4. get_public_api or dependency graph for narrow understanding
5. read only the files you will change
6. delegate broad exploration if needed
```

## Anti-patterns

### Reading Entire Files for One Function

```text
BAD:
Read a 200-line service just to locate one method

GOOD:
find_symbol first, then open the specific file you need
```

### Loading All Skills Upfront

```text
BAD:
Load every architecture, ORM, testing, and infra skill at session start

GOOD:
Load only the skills that the current task actually needs
```

### Not Using Subagents for Exploration

```text
BAD:
Pollute the main context by reading many files for a one-line summary

GOOD:
Delegate exploration and keep the main thread focused on implementation
```

### Treating a Large Window as Unlimited

```text
BAD:
"The window is huge, so let's load everything."

GOOD:
Use the minimum viable context needed to safely do the task.
```

## Decision Guide

| Scenario | Recommendation |
|----------|----------------|
| Need to find where a symbol is defined | `find_symbol` first |
| Need to understand a type's API | `get_public_api` first |
| Need to understand module relationships | `get_module_graph` first |
| Need to modify a file | Read it fully before editing |
| Need unfamiliar subsystem context | Use a subagent or MCP summary |
| Read more than 10 files already | Pause and switch to summaries/MCP |
| Context feels heavy | Summarize what is known and narrow the scope |
| Large codebase | Module graph first, then targeted reads |
