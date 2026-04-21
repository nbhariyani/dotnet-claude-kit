# Vetted npm Package Recommendations

> Last updated: April 2026

Curated packages that `nestjs-claude-kit` recommends by default. Every entry includes rationale and when not to use it.

## Critical: Always Use Current Stable Versions

Do not trust hardcoded package versions from memory.

1. Prefer `npm install <package>` or `pnpm add <package>` without pinning an old version manually.
2. If you must pin a version, verify it from the registry first.
3. Match major versions across the NestJS ecosystem.
4. Re-check recommendations for security and maintenance before adopting niche libraries.

---

## Framework

### NestJS

- **Package:** `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- **Rationale:** The default framework foundation for this kit.
- **When NOT to use:** If you're building a package or tool with no HTTP/server concerns.

---

## Validation and Transformation

### class-validator + class-transformer

- **Package:** `class-validator`, `class-transformer`
- **Rationale:** The default DTO validation path in NestJS.
- **When NOT to use:** If the project has already standardized on Zod or another schema-first validator.

### Zod

- **Package:** `zod`
- **Rationale:** Strong option for schema-first validation and shared runtime types, especially across frontend/backend boundaries.
- **When NOT to use:** If the codebase is already deeply invested in class-based DTOs and validation pipes.

---

## ORM / Data Access

### Prisma

- **Package:** `prisma`, `@prisma/client`
- **Rationale:** Excellent type safety, strong greenfield default, and clean schema workflow.
- **When NOT to use:** If the team strongly prefers decorator-based entities or already has established TypeORM patterns.

### TypeORM

- **Package:** `typeorm`, relevant driver package, `@nestjs/typeorm`
- **Rationale:** Works naturally with Nest modules, decorators, and repository patterns when used carefully.
- **When NOT to use:** If schema-first workflows or Prisma's generated types are a better fit for the team.

---

## Documentation

### Swagger / OpenAPI

- **Package:** `@nestjs/swagger`, `swagger-ui-express`
- **Rationale:** Standard OpenAPI generation path for NestJS APIs.
- **When NOT to use:** If the service is internal and intentionally avoids live API docs.

---

## Logging and Observability

### nestjs-pino

- **Package:** `nestjs-pino`, `pino`, `pino-http`
- **Rationale:** Fast structured logging with good Nest integration.
- **When NOT to use:** If the app is tiny and the built-in logger is sufficient, or the organization has a mandated logging stack.

### OpenTelemetry

- **Package:** `@opentelemetry/api`, Nest/Node instrumentations, OTLP exporter packages
- **Rationale:** Vendor-neutral telemetry for distributed systems.
- **When NOT to use:** If the system is small enough that the observability overhead is not justified yet.

---

## Testing

### Jest

- **Package:** `jest`, `ts-jest`, `@types/jest`
- **Rationale:** Standard test framework in NestJS projects.
- **When NOT to use:** Only if the repo already uses another test runner consistently.

### SuperTest

- **Package:** `supertest`, `@types/supertest`
- **Rationale:** Standard HTTP assertion tool for Nest controller/e2e tests.
- **When NOT to use:** If the project does not expose HTTP endpoints.

### Testcontainers

- **Package:** `testcontainers`
- **Rationale:** Real infrastructure for integration tests without shared environments.
- **When NOT to use:** If CI cannot run containers or the tests are purely unit-level.

---

## Security and Platform

### Helmet

- **Package:** `helmet`
- **Rationale:** Safe default for common HTTP hardening headers.
- **When NOT to use:** Rarely skipped entirely; more often configured selectively.

### Passport + JWT

- **Package:** `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`
- **Rationale:** Common default for token-based auth in NestJS APIs.
- **When NOT to use:** If the system uses session auth, third-party auth middleware, or a different token strategy.

---

## Queues and Background Work

### BullMQ

- **Package:** `bullmq`, `@nestjs/bullmq`
- **Rationale:** Strong Redis-backed choice for jobs, retries, and background processing.
- **When NOT to use:** If the workload is tiny, fully synchronous, or the platform already provides a queue abstraction.

---

## Caching

### cache-manager

- **Package:** `cache-manager`, relevant Nest integration package
- **Rationale:** Common baseline caching abstraction in NestJS.
- **When NOT to use:** If the app needs very custom caching semantics or already has a direct Redis abstraction.

### Redis

- **Package:** `ioredis` or the Redis client standardized by the project
- **Rationale:** Backing store for caching, queues, and distributed coordination.
- **When NOT to use:** If the app does not need shared/distributed cache behavior.

---

## HTTP Client

### HttpModule / Axios

- **Package:** `@nestjs/axios`, `axios`
- **Rationale:** Default Nest-friendly path for outbound HTTP with DI integration.
- **When NOT to use:** If the project prefers native `fetch` and has already standardized on that style.

---

## Configuration

### @nestjs/config

- **Package:** `@nestjs/config`
- **Rationale:** Centralized configuration access through DI instead of raw environment reads.
- **When NOT to use:** Rarely; this is usually the right default in Nest apps.
