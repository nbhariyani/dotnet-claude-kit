# Codex Agent Configuration

This project uses `nestjs-claude-kit` for NestJS and TypeScript development guidance.

## Available Agents

| Agent | File | When to Use |
|-------|------|-------------|
| nestjs-architect | `agents/nestjs-architect.md` | Architecture decisions, project structure, module boundaries, feature scaffolding |
| api-designer | `agents/api-designer.md` | Controller design, OpenAPI, versioning, rate limiting, CORS, guards, pipes |
| orm-specialist | `agents/orm-specialist.md` | Database design, TypeORM and Prisma queries, migrations, repository and data access patterns |
| test-engineer | `agents/test-engineer.md` | Test strategy, Jest, SuperTest, Testcontainers, e2e coverage |
| security-auditor | `agents/security-auditor.md` | Auth systems, authorization, OWASP concerns, secrets management, security review |
| performance-analyst | `agents/performance-analyst.md` | Profiling, memory usage, caching strategy, async and query optimization |
| devops-engineer | `agents/devops-engineer.md` | Docker, CI/CD pipelines, deployment, container publishing |
| code-reviewer | `agents/code-reviewer.md` | Multi-dimensional code review, PR review, consistency and risk analysis |
| build-error-resolver | `agents/build-error-resolver.md` | Autonomous TypeScript and build error fixing, iterative repair loops |
| refactor-cleaner | `agents/refactor-cleaner.md` | Dead code removal, systematic cleanup, safe refactoring |

## Skills

Skills live in `skills/<skill-name>/SKILL.md` and follow the Agent Skills open standard.

### NestJS Domain Skills
api-versioning, architecture-advisor, authentication, caching, ci-cd, clean-architecture, configuration, controllers, ddd, dependency-injection, docker, error-handling, feature-modules, guards, httpclient, interceptors, messaging, migration-workflow, modern-typescript, openapi, performance, pipes, pino-logging, prisma, project-setup, project-structure, resilience, scaffolding, scalar, security-scan, swagger-ui, testing, typeorm, validation, verification-loop, container-publish

### Workflow Skills
code-review-workflow, convention-learner, verification-loop, workflow-mastery

### Meta and Productivity Skills
80-20-review, autonomous-loops, context-discipline, learning-log, model-selection, self-correction-loop, session-management, split-memory, wrap-up-ritual

## MCP Tools

The `cwm-ts-navigator` MCP server provides TypeScript-oriented code intelligence:

| Tool | Purpose |
|------|---------|
| `find_symbol` | Locate where a type, class, method, or function is defined |
| `find_references` | Find all usages of a symbol across the project |
| `find_implementations` | Find types implementing an interface |
| `find_callers` | Find call sites for a function or method |
| `get_public_api` | Get exported or public members without reading the whole file |
| `get_type_hierarchy` | Get inheritance and implementation relationships |
| `get_module_graph` | Get module dependency structure and import relationships |
| `get_dependency_graph` | Get recursive dependency flow for a symbol |
| `get_diagnostics` | Get TypeScript compiler diagnostics |
| `get_test_coverage_map` | Heuristic map of files to tests |
| `find_dead_code` | Identify likely unused exports or unreachable code |
| `detect_circular_deps` | Find circular module dependencies |

Always prefer MCP tools over reading full source files when they can answer the question cleanly.

## Rules

Always-applied editor conventions live in `.cursor/rules/`:

- `nestjs-rules.md` -- NestJS and TypeScript coding, architecture, testing, security, tooling, and workflow rules
