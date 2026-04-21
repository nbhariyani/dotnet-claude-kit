<div align="center">
  <h1>nestjs-claude-kit</h1>
  <p><strong>Make Claude Code an expert NestJS developer.</strong></p>
  <p>Architecture-aware. Token-efficient. Built for NestJS and TypeScript.</p>
</div>

## What It Is

`nestjs-claude-kit` is a Claude Code companion for NestJS projects. It gives Claude structured guidance for feature modules, controllers, DTO validation, TypeORM/Prisma, testing, security, performance, CI/CD, and code review.

Instead of generating generic Node.js code, Claude gets project-ready conventions, specialist agents, reusable skills, templates, hooks, and a TypeScript MCP server for codebase navigation.

## What It Helps With

- Architecture-aware planning for Feature Modules, Clean Architecture, DDD, and Modular Monoliths
- Endpoint and controller design with DTO validation and OpenAPI guidance
- TypeORM and Prisma workflows, including migrations and query review
- Jest, SuperTest, and Testcontainers-based testing guidance
- Security, performance, refactoring, and build-fix workflows
- Token-efficient project exploration through `cwm-ts-navigator`

## Production Baseline

The repo's default NestJS standard is a practical production baseline:

- Feature Modules with explicit module boundaries
- DTOs for request and response contracts
- global `ValidationPipe` and centralized exception handling
- `APP_GUARD` + `@Public()` for default-protected APIs
- JWT-based auth with refresh-token rotation when sessions must persist
- `@nestjs/config` + env validation for application config
- migrations over schema sync, with reviewed migration files committed to source control
- seed workflows for local setup, demos, and test data when the app needs them
- Swagger/OpenAPI generation for API visibility and client generation
- Jest + SuperTest, with Testcontainers for real integration coverage
- Helmet, throttling, CORS, and health endpoints wired intentionally

## Quick Start

1. Add the plugin to Claude Code.
2. Copy the right template `CLAUDE.md` into your NestJS project.
3. Configure the MCP server from `mcp-configs/mcp-servers.json`.
4. Start working with Claude using the provided commands and skills.

## Main Building Blocks

### Skills

Skills are compact, code-heavy reference files that teach Claude how this stack should be built.

Examples:

- `modern-typescript`
- `controllers`
- `feature-modules`
- `typeorm`
- `prisma`
- `testing`
- `security-scan`
- `verification-loop`

### Agents

Agents route work to the right specialty:

- `nestjs-architect`
- `api-designer`
- `orm-specialist`
- `test-engineer`
- `security-auditor`
- `performance-analyst`
- `code-reviewer`
- `build-error-resolver`

### Commands

Examples:

- `/nest-init`
- `/plan`
- `/scaffold`
- `/verify`
- `/tdd`
- `/migrate`
- `/code-review`
- `/security-scan`

### Templates

- `nestjs-rest-api`
- `nestjs-modular-monolith`
- `nestjs-shared-library`
- `nestjs-worker`

### MCP Server

The repo includes `cwm-ts-navigator`, a read-only TypeScript MCP server for:

- symbol lookup
- references
- diagnostics
- module graph analysis
- circular dependency detection
- dead code checks
- test coverage mapping

## Repo Structure

```text
.
|-- agents/
|-- commands/
|-- hooks/
|-- knowledge/
|-- mcp/
|   |-- cwm-ts-navigator/
|-- mcp-configs/
|-- skills/
|-- templates/
|-- AGENTS.md
|-- CLAUDE.md
```

## Who It Is For

This repo is for teams who want Claude Code to behave like a strong NestJS teammate instead of a generic code generator.

It is especially useful when you want:

- consistent NestJS conventions
- better code reviews and safer scaffolding
- lower token use while exploring larger codebases
- sharper defaults for validation, auth, module boundaries, and persistence
- clearer production-ready defaults for testing, migrations, seeds, and API docs

## Related Docs

- [AGENTS.md](AGENTS.md)
- [CLAUDE.md](CLAUDE.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [mcp-configs/README.md](mcp-configs/README.md)
- [docs/shorthand-guide.md](docs/shorthand-guide.md)
- [docs/longform-guide.md](docs/longform-guide.md)
