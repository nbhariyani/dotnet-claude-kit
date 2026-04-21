---
alwaysApply: true
description: >
  Agent and tool usage rules for NestJS projects: MCP-first navigation,
  subagent routing, model selection, and skill loading strategy.
---

# Agent & Tool Usage Rules (NestJS)

## MCP Tools Before File Reading

- **DO** use ts-morph MCP tools (`find_symbol`, `find_references`, `get_public_api`,
  `get_type_hierarchy`) before reading source files.
  Rationale: MCP tools return focused, token-efficient results. Reading full files wastes context.

- **DO** use `get_module_graph` before making any structural changes (new modules,
  moved providers, changed exports).
  Rationale: Understanding the module dependency graph prevents circular imports and
  misplaced providers.

- **DO** use `get_diagnostics` after modifications instead of running `npm run build`
  when possible.
  Rationale: TypeScript diagnostics are faster and return structured data without
  full compilation artifacts.

- **DON'T** read entire files to find a single class or function. Use `find_symbol` first.
  Rationale: A 500-line file costs tokens. A symbol lookup costs almost nothing.

## Subagent Routing

- **DO** use subagents for parallel research, exploration, and independent tasks.
- **DO** assign one task per subagent for focused execution.
- **DO** route to specialist agents for domain-specific work. Check AGENTS.md routing table.
- **DON'T** use subagents for trivial, single-step tasks.

## Model Selection

- **DO** use Sonnet for routine tasks: formatting, simple refactors, test generation.
  Rationale: Sonnet is faster and cheaper for well-defined, low-ambiguity work.
- **DO** use Opus for complex architecture decisions, design reviews, and multi-system analysis.

## Skill Loading

- **DO** load `modern-typescript` first before any other skill.
- **DO** load relevant domain skills before starting work. Check AGENTS.md skill maps.
- **DON'T** start implementation without checking if a relevant skill exists.

## Quick Reference

| Need | Tool / Approach |
|---|---|
| Find where a class is defined | `find_symbol` |
| Understand who calls a function | `find_callers` |
| Check public API surface | `get_public_api` |
| Verify no TypeScript errors | `get_diagnostics` |
| Understand module imports | `get_module_graph` |
| Parallel research | Subagent |
| Architecture decision | Opus + `nestjs-architect` agent |
| Routine refactor | Sonnet |
