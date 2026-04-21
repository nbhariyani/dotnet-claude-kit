---
alwaysApply: true
description: >
  NestJS package management rules: always use latest stable versions, vetted
  package list, pnpm preference, and central version management.
---

# Package Management Rules (NestJS)

## Always Use Latest Stable Versions

- **Never hardcode package versions from memory.** Training data contains outdated
  versions. Always verify the latest stable version before adding a package.
- **Run `npm install <name>` (or `pnpm add <name>`) without a version flag** to get
  the latest stable release automatically.

```bash
# DO — gets latest stable
pnpm add @nestjs/swagger class-validator class-transformer

# DON'T — hardcoded version likely outdated
pnpm add @nestjs/swagger@7.0.0
```

## Vetted Package Stack

| Category | Package | Notes |
|---|---|---|
| Framework | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | Core |
| ORM (default) | `typeorm`, `@nestjs/typeorm` | Code-first |
| ORM (alternative) | `prisma`, `@prisma/client` | Schema-first |
| Validation | `class-validator`, `class-transformer` | Required pair |
| Auth | `@nestjs/passport`, `passport-jwt`, `@nestjs/jwt` | Standard |
| Config | `@nestjs/config` | Always use over `process.env` |
| Swagger | `@nestjs/swagger`, `swagger-ui-express` | OpenAPI 3 |
| Health | `@nestjs/terminus` | — |
| Caching | `@nestjs/cache-manager`, `cache-manager`, `ioredis` | Redis backend |
| Messaging | `@nestjs/bullmq`, `bullmq` | Queue-based |
| Scheduling | `@nestjs/schedule` | Cron jobs |
| HTTP client | `@nestjs/axios` | Never raw `axios` |
| Logging | `nestjs-pino`, `pino` | Structured logging |
| Resilience | `cockatiel` | Retry/circuit-breaker |
| Security | `helmet`, `@nestjs/throttler` | Always apply |
| Testing | `jest`, `supertest`, `@testcontainers/postgresql` | Standard test stack |
| Result pattern | `neverthrow` | When typed failures needed |

## Package Manager

- **Prefer `pnpm` over `npm` and `yarn`** for disk efficiency and strict dependency
  isolation. Do not mix package managers within a project — check for `pnpm-lock.yaml`,
  `package-lock.json`, or `yarn.lock` before choosing.

## DO / DON'T Quick Reference

| DO | DON'T |
|---|---|
| `pnpm add <package>` (no version) | Hardcode version from memory |
| Verify latest on npmjs.com if unsure | Trust training data for version numbers |
| `@nestjs/config` + `ConfigService` | `process.env.X` directly in code |
| `@nestjs/axios` for HTTP calls | Raw `require('axios')` |
| `nestjs-pino` for logging | `console.log` |
