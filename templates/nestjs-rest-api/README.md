# nestjs-rest-api Template

Drop-in Claude Code companion for NestJS REST APIs using Feature Modules architecture.

## When to Use

Use this template when:
- Building a REST API with NestJS
- Using Feature Modules (one module per domain)
- Using TypeORM with PostgreSQL
- Team size: 1–10 engineers

For larger teams with complex domain logic, consider `nestjs-modular-monolith` instead.

## How to Use

1. Copy `CLAUDE.md` into your project root
2. Start Claude Code in your project directory
3. Ask Claude to load the relevant skills before starting work

```bash
# Bootstrap a new project
nest new my-api
cp CLAUDE.md my-api/CLAUDE.md
cd my-api
claude
```

## Included Skills

| Skill | Purpose |
|---|---|
| `modern-typescript` | TypeScript 5.x idioms, strict mode |
| `controllers` | Controller patterns, DTOs, pipes |
| `dependency-injection` | Module wiring, provider registration |
| `authentication` | JWT auth, guards, APP_GUARD pattern |
| `typeorm` | Entities, repositories, migrations |
| `error-handling` | HttpException hierarchy, global filter |
| `testing` | Jest, SuperTest, Testcontainers |
| `openapi` | Swagger/OpenAPI documentation |

## Architecture Conventions

- **Feature Modules** — one module per domain (`orders/`, `users/`, etc.)
- **Global pipes + filters** in `main.ts` — not per-controller
- **`APP_GUARD` default auth** — opt out with `@Public()`, not opt in
- **DTOs for all I/O** — entities never exposed directly
- **Migrations only** — `synchronize: false` in production

## Agents

| Agent | When to Use |
|---|---|
| `nestjs-architect` | Module structure, architecture questions |
| `api-designer` | Endpoint design, DTO design, Swagger |
| `orm-specialist` | TypeORM queries, migrations, entities |
| `test-engineer` | E2E and unit test setup |
| `security-auditor` | Auth, validation, security review |
