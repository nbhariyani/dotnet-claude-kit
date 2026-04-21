# nestjs-modular-monolith Template

Drop-in Claude Code companion for NestJS Modular Monolith projects with strict domain boundary enforcement.

## When to Use

Use this template when:
- Building a system with multiple business domains (orders, payments, inventory, notifications)
- Team size: 5–30 engineers
- You want clean boundaries now so extraction to microservices is possible later
- You need durable cross-domain messaging (BullMQ queues or EventEmitter2)

Use `nestjs-rest-api` instead if you have a single domain or simple CRUD needs.

## How to Use

```bash
nest new my-monolith
cp CLAUDE.md my-monolith/CLAUDE.md
cd my-monolith
claude
```

## Key Differences from nestjs-rest-api

| Concern | nestjs-rest-api | nestjs-modular-monolith |
|---|---|---|
| Cross-domain calls | Direct service import (OK) | Integration events only (BullMQ / EventEmitter2) |
| Domain isolation | Module-level | Hard — no shared entities |
| Table naming | Simple | Domain-prefixed (`orders_*`, `payments_*`) |
| Testing scope | Full app E2E | Per-domain E2E |
| Complexity | Lower | Higher — justified by domain count |

## Architecture Conventions

- **Integration events for cross-domain communication** — no direct service imports across domains
- **Per-domain table prefixes** — signals data ownership in the schema
- **Shared kernel (`common/`)** for cross-cutting concerns only (guards, filters, decorators)
- **BullMQ for durable async events** — survives process restarts

## Included Skills

| Skill | Purpose |
|---|---|
| `modern-typescript` | TypeScript 5.x idioms |
| `feature-modules` | Module boundaries, exports[] |
| `messaging` | BullMQ, EventEmitter2 integration |
| `dependency-injection` | Provider wiring, tokens |
| `typeorm` | Domain entities, migrations |
| `authentication` | JWT auth, APP_GUARD pattern |
| `error-handling` | HttpException hierarchy, global filter |
| `testing` | E2E with Testcontainers |

## Agents

| Agent | When to Use |
|---|---|
| `nestjs-architect` | Domain boundary design, event topology |
| `orm-specialist` | Per-domain schemas, cross-domain transactions |
| `test-engineer` | Domain E2E tests, BullMQ processor tests |
| `security-auditor` | Auth, validation, security review |
