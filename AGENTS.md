# Agent Routing & Orchestration

> This file defines how Claude Code routes queries to specialist agents and how agents coordinate.

## Agent Roster

| Agent | File | Primary Domain |
|-------|------|---------------|
| nestjs-architect | `agents/nestjs-architect.md` | Architecture, project structure, module boundaries |
| api-designer | `agents/api-designer.md` | Controllers, OpenAPI, versioning, rate limiting |
| orm-specialist | `agents/orm-specialist.md` | Database, queries, migrations, TypeORM / Prisma |
| test-engineer | `agents/test-engineer.md` | Test strategy, Jest, SuperTest, Testcontainers |
| security-auditor | `agents/security-auditor.md` | Authentication, authorization, OWASP, secrets |
| performance-analyst | `agents/performance-analyst.md` | Profiling, memory, async patterns, caching |
| devops-engineer | `agents/devops-engineer.md` | Docker, CI/CD, deployment |
| code-reviewer | `agents/code-reviewer.md` | Multi-dimensional code review |
| build-error-resolver | `agents/build-error-resolver.md` | Autonomous build error fixing |
| refactor-cleaner | `agents/refactor-cleaner.md` | Systematic dead code removal and cleanup |

## Routing Table

Match user intent to agent. When multiple agents could handle a query, the first match wins.

| User Intent Pattern | Primary Agent | Support Agent |
|---|---|---|
| "set up project", "folder structure", "architecture" | nestjs-architect | — |
| "add module", "split into modules", "bounded context" | nestjs-architect | — |
| "create endpoint", "API route", "controller", "OpenAPI", "swagger" | api-designer | — |
| "versioning", "rate limiting", "CORS", "guard", "interceptor", "pipe" | api-designer | — |
| "database", "migration", "query", "TypeORM", "Prisma", "entity" | orm-specialist | — |
| "write tests", "test strategy", "coverage", "Jest", "SuperTest" | test-engineer | — |
| "createTestingModule", "Testcontainers", "e2e test" | test-engineer | — |
| "security", "authentication", "JWT", "passport", "authorize", "guard" | security-auditor | — |
| "performance", "benchmark", "memory", "profiling", "event loop" | performance-analyst | — |
| "caching", "cache-manager", "Redis", "BullMQ" | performance-analyst | — |
| "Docker", "container", "CI/CD", "pipeline", "deploy" | devops-engineer | — |
| "review this code", "PR review", "code quality" | code-reviewer | — |
| "choose architecture", "which architecture", "architecture decision" | nestjs-architect | — |
| "scaffold feature", "create feature", "generate feature", "nest generate" | nestjs-architect | api-designer, orm-specialist |
| "init project", "setup project", "new project", "generate CLAUDE.md" | nestjs-architect | — |
| "health check", "analyze project", "project report" | code-reviewer | nestjs-architect |
| "review PR", "review changes", "code review" | code-reviewer | — |
| "add migration", "typeorm migration", "prisma migrate" | orm-specialist | — |
| "conventions", "coding style", "detect patterns", "code consistency" | code-reviewer | — |
| "add feature" (architecture-appropriate) | nestjs-architect | api-designer, orm-specialist |
| "refactor" | code-reviewer | nestjs-architect |
| "build errors", "fix build", "tsc error", "typescript error" | build-error-resolver | — |
| "clean up", "dead code", "unused code", "de-sloppify" | refactor-cleaner | — |

## Skill Loading Order

Agents load skills in dependency order. Core skills load first.

### Default Load Order (All Agents)
1. `modern-typescript` — Always loaded, baseline TypeScript/NestJS knowledge
2. Agent-specific skills (see agent files)

### Per-Agent Skill Maps

| Agent | Skills |
|-------|--------|
| nestjs-architect | modern-typescript, architecture-advisor, project-structure, scaffolding, project-setup + conditional: feature-modules, clean-architecture, ddd |
| api-designer | modern-typescript, controllers, api-versioning, authentication, error-handling, validation, openapi |
| orm-specialist | modern-typescript, typeorm, prisma, configuration, migration-workflow |
| test-engineer | modern-typescript, testing |
| security-auditor | modern-typescript, authentication, configuration, security-scan |
| performance-analyst | modern-typescript, caching, performance |
| devops-engineer | modern-typescript, docker, ci-cd |
| code-reviewer | modern-typescript, code-review-workflow, convention-learner + contextual (loads relevant skills based on files under review) |
| build-error-resolver | modern-typescript, autonomous-loops + contextual: typeorm, dependency-injection |
| refactor-cleaner | modern-typescript, de-sloppify + contextual: testing, typeorm |

## MCP Tool Preferences

Agents should **prefer ts-morph MCP tools over file scanning** to reduce token consumption.

| Task | Use MCP Tool | Instead Of |
|------|-------------|-----------|
| Find where a type/class is defined | `find_symbol` | Grep across all .ts files |
| Find all usages of a class/function | `find_references` | Grep for the identifier |
| Find implementations of an interface | `find_implementations` | Searching for `implements Interface` |
| Understand class hierarchy | `get_type_hierarchy` | Reading multiple files |
| Understand module import graph | `get_module_graph` | Parsing import statements manually |
| Review a class's public API | `get_public_api` | Reading the full source file |
| Check for TypeScript errors | `get_diagnostics` | Running `npm run build` and parsing output |
| Find unused code for cleanup | `find_dead_code` | Manual inspection of all files |
| Check for circular dependencies | `detect_circular_deps` | Manually tracing imports |
| Understand method call chains | `get_dependency_graph` | Reading multiple files and tracing calls |
| Check which types have tests | `get_test_coverage_map` | Manually searching for spec files |

## Cross-Agent Meta Skills

These 10 meta and productivity skills are not tied to a specific agent — any agent can load them when the context calls for it:

| Skill | When to Load |
|-------|-------------|
| `self-correction-loop` | After ANY user correction — capture the rule in MEMORY.md |
| `wrap-up-ritual` | User signals end of session — write handoff to `.claude/handoff.md` |
| `context-discipline` | Context running low, large codebase navigation, planning exploration strategy |
| `model-selection` | Choosing between Opus/Sonnet/Haiku, assigning subagent models |
| `80-20-review` | Code review, PR review, deciding what to review in depth |
| `split-memory` | CLAUDE.md exceeds 300 lines, need to split instructions across files |
| `learning-log` | Non-obvious discovery during development — log the insight |
| `instinct-system` | Pattern detection across sessions — observe-hypothesize-confirm cycle for project conventions |
| `session-management` | Session start/end — load handoff, detect solution, write session summary |
| `autonomous-loops` | Iterative fix loops — build-fix, test-fix, refactor with bounded iterations |

### Meta Skill Routing

| User Intent Pattern | Skill |
|---|---|
| "learn from mistakes", "remember this", "don't do that again" | self-correction-loop |
| "wrap up", "done for today", "save progress", "handoff" | wrap-up-ritual |
| "context", "running out of tokens", "too many files" | context-discipline |
| "which model", "use Opus", "use Sonnet", "switch model" | model-selection |
| "review this", "what should I review", "blast radius" | 80-20-review |
| "split CLAUDE.md", "too long", "organize instructions" | split-memory |
| "log this", "document this finding", "gotcha" | learning-log |
| "show instincts", "what have you learned", "confidence scores" | instinct-system |
| "start session", "load handoff", "session start" | session-management |
| "fix build loop", "keep fixing", "auto-fix" | autonomous-loops |

## Slash Commands

Commands map to skills and agents. Use these as shortcuts for common workflows.

| Command | Primary Skill | Primary Agent | Purpose |
|---------|--------------|---------------|---------|
| `/nest-init` | project-setup | nestjs-architect | Interactive project initialization |
| `/plan` | architecture-advisor | nestjs-architect | Architecture-aware planning |
| `/verify` | verification-loop | — | Full verification pipeline |
| `/tdd` | testing | test-engineer | Red-green-refactor workflow |
| `/scaffold` | scaffolding | nestjs-architect | Architecture-aware feature scaffolding |
| `/code-review` | code-review-workflow | code-reviewer | MCP-powered code review |
| `/build-fix` | autonomous-loops | build-error-resolver | Iterative TypeScript error fixing |
| `/checkpoint` | wrap-up-ritual | — | Save progress (commit + handoff) |
| `/security-scan` | security-scan | security-auditor | OWASP + secrets + dependency audit |
| `/migrate` | migration-workflow | orm-specialist | Safe TypeORM/Prisma migration workflow |
| `/health-check` | health-check | code-reviewer | Graded project health report |
| `/de-sloppify` | de-sloppify | refactor-cleaner | Systematic code cleanup |
| `/wrap-up` | wrap-up-ritual | — | Session ending ritual |
| `/instinct-status` | instinct-system | — | Show learned instincts |
| `/instinct-export` | instinct-system | — | Export instincts to shareable format |
| `/instinct-import` | instinct-system | — | Import instincts from another project |

## Conflict Resolution

When two agents could handle a query:

1. **Architecture questions win over implementation** — "How should I structure the payments module?" → nestjs-architect, even though api-designer could handle the endpoint part
2. **Specific beats general** — "How do I optimize this TypeORM query?" → orm-specialist, not performance-analyst
3. **Security concerns are always surfaced** — Even when another agent is primary, flag security issues for the security-auditor
4. **Code review is holistic** — The code-reviewer loads skills contextually based on what's in the PR

## Token Budget Guidance

For detailed context management strategies, see the **`context-discipline`** skill.

- **Small queries** (single pattern/fix): Load 1-2 skills, use MCP tools for context
- **Medium queries** (feature implementation): Load 3-4 skills, use MCP tools to understand existing code
- **Large queries** (architecture review): Load all relevant skills, use `get_module_graph` first to understand the project shape

## Response Patterns

All agents should:
1. **Start with the recommended approach** — Don't enumerate all options equally
2. **Show code first, explain after** — Developers prefer seeing the solution, then understanding why
3. **Flag anti-patterns proactively** — If the user's existing code has issues, mention them
4. **Reference skills** — Point to relevant skills for deeper reading
5. **Use MCP tools before reading files** — Reduce token consumption
