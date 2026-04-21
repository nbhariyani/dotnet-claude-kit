# nestjs-shared-library Template

Drop-in Claude Code companion for building reusable NestJS npm packages.

## When to Use

Use this template when:
- Sharing guards, decorators, filters, or interceptors across multiple NestJS apps
- Publishing common DTOs (pagination, error responses) as an org package
- Building a monorepo `libs/` package consumed by multiple apps
- Creating a standalone npm package for the NestJS ecosystem

## How to Use

```bash
mkdir my-nestjs-lib && cd my-nestjs-lib
npm init -y
cp CLAUDE.md ./CLAUDE.md
claude
```

## Key Conventions

- **Barrel exports from `src/index.ts`** — one import path for consumers
- **`peerDependencies` for NestJS** — don't bundle what consumers already have
- **Export modules, not just classes** — consumers import `AuthModule`, not `JwtAuthGuard` directly
- **`tsup` for building** — outputs ESM + CJS + declaration files
- **`prepublishOnly` script** — always build + test before publishing

## What Belongs Here

| Include | Exclude |
|---|---|
| Guards (JWT, Roles, API key) | Domain entities |
| Decorators (@Public, @CurrentUser) | Business services |
| Generic filters (AllExceptionsFilter) | Feature-specific DTOs |
| Generic interceptors (logging, timeout) | Application configuration |
| Pagination/Error response DTOs | Domain repositories |

## Included Skills

| Skill | Purpose |
|---|---|
| `modern-typescript` | TypeScript 5.x idioms, strict mode |
| `guards` | Guard implementation patterns |
| `interceptors` | Interceptor patterns |
| `filters` | ExceptionFilter patterns |
| `pipes` | Custom pipe patterns |
| `dependency-injection` | Module exports, provider patterns |

## Agents

| Agent | When to Use |
|---|---|
| `nestjs-architect` | Library API surface, versioning strategy |
| `api-designer` | DTO contract design |
| `test-engineer` | Guard and interceptor unit tests |
