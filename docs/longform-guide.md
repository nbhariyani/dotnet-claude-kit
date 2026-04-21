# nestjs-claude-kit Deep Dive Guide

This guide explains how the repo is intended to be used and extended.

## Setup Flow

1. Start with the right template.
2. Add the plugin guidance to your project `CLAUDE.md`.
3. Configure the MCP server.
4. Use the appropriate command or agent for the task.

## How the Repo Is Meant to Work

### Skills

Skills are the primary technical knowledge layer. They should stay:

- concise
- example-driven
- opinionated
- current to the active stack

### Agents

Agents route work to the right expertise area and should stay aligned with `AGENTS.md`.

### Commands

Commands are shorthand workflows. They should be easy to trigger from natural developer requests.

### MCP

`cwm-ts-navigator` should be preferred over broad file scanning whenever a symbol, graph, or diagnostic query can answer the question efficiently.

## Recommended Workflow

### For New Work

1. Use `/plan` for non-trivial work.
2. Use the architecture advisor when structure matters.
3. Generate or edit code with the right skills in scope.
4. Verify with diagnostics, build, and tests.

### For Existing Codebases

1. Use MCP tools first.
2. Learn local conventions before generating new code.
3. Keep changes aligned with the project's module boundaries and testing style.

### For Reviews

1. Start with diagnostics and anti-pattern checks.
2. Review blast radius and architecture impact.
3. Focus on correctness, security, persistence, and integration before style.

## Practical NestJS Standards

The repo should consistently guide Claude toward the following practical defaults for modern NestJS projects.

### API Contracts

- Use DTOs for all request and response boundaries.
- Apply global validation in `main.ts`, not ad hoc per controller.
- Keep Swagger/OpenAPI aligned with DTOs and route decorators.
- Prefer explicit versioning strategy early instead of bolting it on later.

### Authentication and Authorization

- Protect routes by default with `APP_GUARD` and opt out using `@Public()`.
- Use `@Roles()` or equivalent policy decorators for privileged routes.
- Prefer short-lived access tokens plus refresh-token rotation for session-like auth flows.
- Keep auth rules in guards and strategies, not controller bodies or interceptors.

### Configuration

- Use `@nestjs/config` and validated env schemas for application code.
- Avoid direct `process.env` access in services and controllers.
- If a CLI bootstrap file such as `data-source.ts` reads env directly, call that out explicitly as an infrastructure exception rather than a general pattern.

### Persistence

- Use migrations, not `synchronize: true`, for shared environments.
- Review generated migrations before committing or running them.
- Document how local data is seeded when examples, demos, or test accounts are important to the project.
- Be explicit about transaction boundaries and query-shape risks such as N+1 queries.

### Testing

- Prefer E2E coverage for HTTP behavior with Jest + SuperTest.
- Use Testcontainers when DB behavior matters.
- Keep unit tests focused on business logic and provider behavior.
- Make test setup mirror production middleware, guards, pipes, and filters where relevant.

### Operations

- Wire Helmet, CORS, health endpoints, and API docs intentionally in bootstrap code.
- Keep CI expectations visible: build, unit tests, E2E tests, and migration execution when required.
- Treat OpenAPI generation, migration application, and seed strategy as part of delivery guidance, not optional afterthoughts.

## What Good Output Looks Like

Good repo guidance should:

- use NestJS and TypeScript examples
- reflect current file names and commands
- avoid stale references to removed systems
- stay focused on practical team outcomes
- make production-safe defaults obvious to the reader

## What to Avoid

- outdated stack references
- examples from removed templates or agents
- guidance that conflicts with the current repo direction
- broad claims that do not match actual files in the repo
- hidden exceptions that make repo rules look contradictory
