---
name: workflow-mastery
description: >
  Claude Code workflow mastery for NestJS and TypeScript projects. Covers
  parallel execution with git worktrees, planning strategy, verification
  loops, formatting hooks, permission setup for Node-based tooling, prompting
  techniques, and reusable subagent patterns.
  Load this skill when setting up Claude Code for a NestJS project, optimizing
  workflows, running parallel sessions, or when the user mentions
  "productivity", "workflow", "parallel", "worktree", "plan mode",
  "permissions", "hooks", "setup Claude Code", or "speed up development".
---

# Workflow Mastery

## Core Principles

1. **Parallel over sequential** - Use separate worktrees or sessions for independent tasks when possible.
2. **Plan then execute** - For multi-file or architecture-sensitive work, make the plan explicit before editing.
3. **Verification closes the loop** - Require proof with `get_diagnostics`, `npm run build`, `npm test`, and targeted checks before calling work done.
4. **Automate the repetitive** - If a step repeats often, turn it into a hook, command, or reusable agent pattern.
5. **Compound project knowledge** - Capture corrections in `MEMORY.md` so repeated mistakes disappear over time.

## Patterns

### Parallel Sessions with Git Worktrees

```bash
git worktree add ../my-project-feature origin/main
git worktree add ../my-project-bugfix origin/main
git worktree add ../my-project-tests origin/main
```

Example setup:

| Worktree | Task | Session Role |
|----------|------|--------------|
| `feature` | Build a new module or endpoint | Main implementation |
| `bugfix` | Fix a failing test or regression | Focused repair |
| `tests` | Add or improve Jest/SuperTest coverage | Verification |
| `analysis` | Review architecture, graphs, and diagnostics | Read-only investigation |

### Post-Edit Formatting Hook

Use a non-blocking formatter hook so file writes stay clean:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint:fix -- --file \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

If the repo uses Biome, Prettier, or ESLint directly, swap in the local command that matches team conventions.

### Pre-Allow Safe Tooling Permissions

Pre-allow the commands that are routine and low-risk for this stack:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build*)",
      "Bash(npm test*)",
      "Bash(npm run lint*)",
      "Bash(npx nest *)",
      "Bash(pnpm test*)",
      "Bash(pnpm build*)"
    ]
  }
}
```

### Planning Strategy

For tasks touching several files or changing structure:

```text
1. State the scope and constraints
2. Identify files/modules likely to change
3. Check module graph and diagnostics
4. Validate edge cases before editing
5. Execute only after the plan is coherent
```

Useful review prompt:

```text
"Review this plan as a staff NestJS engineer.
Challenge the module boundaries, DTO flow, validation, and test strategy."
```

### Verification Loop

Short version:

```text
1. get_diagnostics
2. npm run build
3. npm test
4. detect_antipatterns
5. review diff for accidental regressions
```

For the full sequence, use the `verification-loop` skill.

### Compounding Knowledge via Corrections

After every meaningful correction, generalize it into a rule in `MEMORY.md`.
For the full process, use the `self-correction-loop` skill.

### Prompting Techniques

**Challenge the implementation**

```text
"Grill this like a staff NestJS engineer.
Check module boundaries, validation, auth coverage, query risks, and test gaps."
```

**Demand proof**

```text
"Prove this works. Run diagnostics, build, tests, and summarize the result."
```

**Push past the first draft**

```text
"Knowing everything you know now, replace the workaround with the clean solution."
```

**For database work**

```text
"Show the migration or schema change explicitly and explain the rollout risk."
```

### Reusable Subagent Patterns

```markdown
<!-- .claude/agents/verify-api.md -->
You are a NestJS API verification agent. Your job:
1. Run get_diagnostics
2. Run npm run build
3. Run npm test
4. Check controllers use DTOs and validation appropriately
5. Check no secrets or internal entities leak through responses
Report: PASS with summary, or FAIL with precise issues.
```

```markdown
<!-- .claude/agents/code-simplifier.md -->
You simplify TypeScript/NestJS changes without changing behavior.
Focus on:
- clearer DTO/service boundaries
- better module wiring
- removing duplication
- replacing ad hoc config access with ConfigService
```

## Anti-patterns

### Skipping Planning for Complex Tasks

```text
BAD:
"Refactor the Orders module into DDD" and start editing immediately

GOOD:
Plan module boundaries, contracts, persistence strategy, and tests first.
```

### Doing Sequential Work That Could Be Parallel

```text
BAD:
Build feature, then tests, then docs in one linear session

GOOD:
Use separate sessions/worktrees when tasks do not depend on each other.
```

### Accepting the First Working Solution

```text
BAD:
"It builds, ship it."

GOOD:
Ask whether the result is clean, idiomatic, and maintainable for the project.
```

## Decision Guide

| Scenario | Recommendation |
|----------|----------------|
| Task touches 3+ files | Plan first |
| Task is a simple bug fix | Fix it directly, then verify |
| Need build + tests + review | Consider parallel sessions |
| CI keeps failing on formatting | Add or refine a format hook |
| Tired of permission prompts | Pre-allow safe Node/Nest commands |
| Claude made a repeated mistake | Capture it in memory |
| Code feels hacky | Ask for the clean solution, not the first solution |
| Need a second opinion | Use another session or review agent |
