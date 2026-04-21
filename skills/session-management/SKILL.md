---
name: session-management
description: >
  End-to-end session lifecycle management for NestJS and TypeScript projects.
  Handles session start (load handoff, MEMORY.md, instincts, detect tsconfig/MCP
  context), session end (capture completed work, persist learnings, write
  handoff), and context preservation across sessions.
  Load this skill when starting a new session, ending a session, when the user
  says "new session", "pick up where we left off", "what were we working on",
  "session start", "session end", "handoff", "context", or "resume".
---

# Session Management

## Core Principles

1. **Sessions start with context, not from scratch** - Load the handoff, memory, instincts, and project configuration before pretending the session is brand new.
2. **Sessions end with capture** - Record what was completed, what is pending, and what was learned.
3. **Context preservation is a chain** - Handoff files, memory, instincts, and git state work together.
4. **Project detection enables tooling** - TypeScript MCP tools are most useful when the relevant `tsconfig.json` or workspace structure is known.
5. **Graceful degradation over hard failure** - Missing context files should not block work.

## Patterns

### Session Start Protocol

```text
STEP 1: Load handoff
  -> check for .claude/handoff.md

STEP 2: Load memory
  -> check for MEMORY.md or .claude/MEMORY.md

STEP 3: Load instincts
  -> check for .claude/instincts.md

STEP 4: Detect project config
  -> search for tsconfig.json, nest-cli.json, package.json
  -> confirm MCP-friendly project shape when possible

STEP 5: Present summary
  -> summarize prior work, pending tasks, active rules, and detected project shape
```

### Session End Protocol

```text
STEP 1: Summarize accomplishments
STEP 2: Check git status
STEP 3: Write .claude/handoff.md
STEP 4: Capture reusable learnings in MEMORY.md
STEP 5: Update instincts if new patterns emerged
STEP 6: Confirm what the next session should pick up
```

### Project Detection Strategy

Prefer the files that matter for the current stack:

```text
SEARCH ORDER:
1. tsconfig.json
2. nest-cli.json
3. package.json
4. workspace-level config if monorepo

AFTER DETECTION:
- note likely package manager and build/test commands
- verify MCP tooling can target the project cleanly
- avoid re-detecting unless the workspace changes
```

### Context Preservation Architecture

```text
FILE                    SCOPE       PURPOSE
.claude/handoff.md      Session     Pending work and resume notes
MEMORY.md               Project     Confirmed reusable rules
.claude/instincts.md    Project     Emerging patterns and confidence
Git status/commits      Code        Actual code state
```

### Handoff File Template

```markdown
# Session Handoff

> Generated: 2026-04-21 | Branch: feature/orders-module

## Completed
- [x] Added create-order DTO validation
- [x] Fixed provider export in orders.module.ts

## Pending
- [ ] Add e2e coverage for create-order flow
- [ ] Verify migration rollout plan

## Learned
- This project uses shared DTOs only from exported module contracts
- Tests use Jest + SuperTest with module-level helpers

## Context
- Branch: feature/orders-module
- Last commit: "Add create-order validation"
- Uncommitted changes: yes/no
- Project config: tsconfig.json at repo root
```

### Resuming from Handoff

```text
1. Read handoff
2. Summarize completed and pending work clearly
3. Confirm before auto-continuing pending work
4. If the user wants something else, proceed and refresh the handoff later
```

### First Session Bootstrap

```text
1. No handoff -> start fresh
2. No memory -> create on first durable learning
3. No instincts -> start tracking patterns gradually
4. Detect project structure
5. Offer a convention scan if the codebase is unfamiliar
```

## Anti-patterns

### Starting Blind

```text
BAD:
Ask the user to re-explain prior work when a handoff already exists

GOOD:
Summarize prior work up front and ask whether to continue it
```

### Ending Without Capture

```text
BAD:
Wrap the session with no handoff or memory update

GOOD:
Save the next session from re-discovery by writing a concise handoff
```

### Overwriting Shared Context Without Consent

```text
BAD:
Silently replace an unrelated handoff from another developer

GOOD:
Ask whether to merge, overwrite, or skip when the existing handoff appears unrelated
```

### Bloated Handoffs

```text
BAD:
Write a mini novel into handoff.md

GOOD:
Keep it concise, actionable, and easy to resume from
```

## Decision Guide

| Scenario | Action |
|----------|--------|
| Starting a new session | Run the Session Start Protocol |
| User says "wrap up" | Run the Session End Protocol |
| No handoff exists | Start clean and create one at session end |
| No memory exists | Create it on first reusable correction |
| Multiple project configs exist | Summarize and ask only if ambiguity matters |
| User wants to resume prior work | Summarize and confirm before continuing |
| User wants new work instead | Proceed and update handoff later |
| Session had corrections | Capture them in memory |
| Session revealed new patterns | Update instincts |
