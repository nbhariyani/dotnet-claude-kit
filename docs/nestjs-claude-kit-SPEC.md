# nestjs-claude-kit Repository Specification

## Repo Identity

| Field | Value |
|---|---|
| Repo name | `nestjs-claude-kit` |
| Audience | NestJS and TypeScript teams using Claude Code |
| Core value | Architecture-aware, token-efficient, project-ready guidance |
| Primary MCP | `cwm-ts-navigator` |

## Product Goals

The repository should provide:

- practical NestJS skills
- specialist agents for common backend tasks
- command shortcuts for repeated workflows
- templates for common project shapes
- MCP support for efficient codebase exploration

## Core Domains

### Architecture

- Feature Modules
- Clean Architecture
- DDD
- Modular Monolith

### API

- controllers
- DTO validation
- versioning
- OpenAPI
- auth and guards

### Persistence

- TypeORM
- Prisma
- migrations
- query review

### Quality

- testing
- code review
- security
- performance
- refactoring

## Repository Sections

```text
agents/
commands/
hooks/
knowledge/
mcp/cwm-ts-navigator/
mcp-configs/
skills/
templates/
```

## Quality Bar

- Skills should be concise and current.
- Agents should reference real skills and real workflows.
- Commands should match natural user intents.
- Docs should match actual files in the repo.
- MCP guidance should prefer ts-morph tools over blind scanning.

## Verification Expectations

For repo work, contributors should prefer:

- targeted diagnostics
- build/test verification where relevant
- consistency checks across docs, skills, agents, and templates

## Future Maintenance

This spec should eventually be renamed to match the current product name, but until then it should remain accurate in substance even if the filename is legacy.
