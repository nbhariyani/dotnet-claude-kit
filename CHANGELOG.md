# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-02-21

### Added
- **Scaffolding skill** — `scaffolding` skill with complete code generation patterns for all 4 architectures (VSA, Clean Architecture, DDD, Modular Monolith). Generates features, entities, tests, and modules.
- **Project Setup skill** — `project-setup` skill with interactive workflows for project initialization (CLAUDE.md generation), codebase health checks (graded report cards), and .NET version migration guidance.
- **Code Review Workflow skill** — `code-review-workflow` skill with structured MCP-driven PR reviews: full review, quick review, and architecture compliance check patterns.
- **Migration Workflow skill** — `migration-workflow` skill with safe workflows for EF Core migrations, NuGet dependency updates, and .NET version upgrades. Includes rollback strategies.
- **Convention Learner skill** — `convention-learner` skill that detects project-specific coding conventions (naming, structure, modifiers) and enforces them in new code and reviews.
- **4 new MCP tools:**
  - `find_dead_code` — Find unused types, methods, and properties across the solution
  - `detect_circular_dependencies` — Detect project-level and type-level circular dependencies
  - `get_dependency_graph` — Visualize method call chains with configurable depth
  - `get_test_coverage_map` — Heuristic test coverage mapping by naming convention
- **4 new hooks:**
  - `post-edit-format.sh` — Auto-format C# files after edits
  - `pre-commit-antipattern.sh` — Detect anti-patterns in staged files before commit
  - `post-test-analyze.sh` — Parse test results and output actionable summary
  - `pre-build-validate.sh` — Validate project structure before build
- **7 new test files** for MCP tools: FindCallers, FindOverrides, GetSymbolDetail, FindDeadCode, DetectCircularDependencies, GetDependencyGraph, GetTestCoverageMap
- **Test data** — UnusedHelper class and OrderServiceTests class in SampleSolution for new tool tests

### Changed
- `dotnet-architect` agent now loads `scaffolding` and `project-setup` skills
- `code-reviewer` agent now loads `code-review-workflow` and `convention-learner` skills
- `ef-core-specialist` agent now loads `migration-workflow` skill
- AGENTS.md routing table expanded with 7 new intent patterns
- AGENTS.md MCP tool preferences table expanded with 4 new tools
- Skills count: 22 → 27
- MCP tools count: 11 → 15
- Hooks count: 2 → 6
- README.md rewritten with "What Makes This 10x" section and updated tables
- Plugin version bumped to 0.4.0

## [0.3.0] — 2026-02-21

### Added
- **Multi-architecture support** — New skills: `architecture-advisor`, `clean-architecture`, `ddd`
- **Workflow mastery skill** — `workflow-mastery` skill covering parallel worktrees, plan mode strategy, verification loops, auto-format hooks, permission setup, and subagent patterns for .NET (inspired by Boris Cherny's tips)
- **Workflow Standards section** in root CLAUDE.md and all 5 templates — plan before building, verify before done, fix bugs autonomously, demand elegance, use subagents, learn from corrections
- **Architecture advisor questionnaire** — 15+ questions across 6 categories to recommend the best-fit architecture (VSA, Clean Architecture, DDD + CA, Modular Monolith)
- **ADR-005** — Multi-architecture decision record superseding ADR-001 (VSA-only default)
- **Plugin distribution** — `.claude-plugin/plugin.json` and `marketplace.json` for Claude Code plugin marketplace
- **Progressive skill loading** — All 20 skill descriptions enriched with trigger keywords for better contextual loading
- **Installation section** in README with plugin marketplace commands

### Changed
- Philosophy updated from "opinionated over encyclopedic" to "guided over prescriptive"
- Architecture default changed from VSA-only to advisor-driven (supports 4 architectures)
- `dotnet-architect` agent now loads `architecture-advisor` first, then conditionally loads architecture-specific skills
- `code-reviewer` agent contextually loads `clean-architecture` and `ddd` for project structure reviews
- All 5 templates updated to reference `architecture-advisor` skill
- `web-api` template now shows 3 architecture options (VSA, CA, DDD)
- `modular-monolith` template updated to support per-module architecture choice
- Skills count: 17 → 21
- Branding: "opinionated" → "definitive"
- ADR-001 marked as superseded by ADR-005
- MediatR description updated to mention architecture-agnostic compatibility

## [Unreleased]

### Added
- Initial repository structure
- Project spec in `docs/dotnet-claude-kit-SPEC.md`
