---
description: >
  Bootstrap a new NestJS project with best-practice scaffolding. Installs vetted
  packages, creates production-ready main.ts, and drops in the nestjs-rest-api
  CLAUDE.md template. Triggers on: "start a new nestjs project", "scaffold a new api",
  "initialize this folder as nestjs", "set up nestjs".
---

# /nest-init

## What

Detects whether the user has an existing NestJS project or needs a new one. Runs
`nest new` if starting fresh, or validates and upgrades an existing setup. Installs
the vetted package stack, configures `main.ts` with global middleware, and copies
the nestjs-rest-api CLAUDE.md template so Claude knows the project conventions.

## When

- "start a new nestjs project"
- "scaffold a new api"
- "initialize this folder as nestjs"
- "set up nestjs for me"
- Starting a fresh project directory with nothing in it

## How

### Step 1: Detect Project State

Check for `nest-cli.json` (existing NestJS project) or `package.json` (generic Node
project). If neither exists, this is a blank directory — run `nest new`.

### Step 2: Create or Validate Project

**New project:**

```bash
npx @nestjs/cli new <project-name> --package-manager pnpm --strict
```

**Existing project:** verify `@nestjs/core` version is 11+ and `typescript` is 5.x.
Flag outdated versions before proceeding.

### Step 3: Install Vetted Packages

```bash
pnpm add helmet @nestjs/config @nestjs/swagger swagger-ui-express \
  class-validator class-transformer nestjs-pino pino-http @nestjs/terminus

pnpm add -D @types/supertest supertest @testcontainers/postgresql jest-mock-extended
```

### Step 4: Create Common Structure

```
src/
  common/
    filters/        (AllExceptionsFilter)
    guards/         (JwtAuthGuard placeholder)
    interceptors/   (LoggingInterceptor)
    decorators/     (@Public decorator)
    dto/            (PaginationDto, etc.)
```

### Step 5: Configure main.ts

Apply global middleware in this order:

1. `app.use(helmet())`
2. `app.enableCors({ origin: config.getOrThrow('ALLOWED_ORIGINS').split(',') })`
3. `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
4. `app.useGlobalFilters(new AllExceptionsFilter())`
5. SwaggerModule setup (dev only, gated on `NODE_ENV !== 'production'`)
6. `await app.listen(config.get('PORT', 3000))`

### Step 6: Copy Template

Copy `templates/nestjs-rest-api/CLAUDE.md` to the project root so the project has
Claude Code conventions baked in from day one.

## Example

```
Initialized NestJS 11 project: my-api/
Installed 9 production packages, 4 dev packages
Created: src/common/filters/all-exceptions.filter.ts
Created: src/common/decorators/public.decorator.ts
Updated: src/main.ts (helmet, ValidationPipe, Swagger)
Copied: CLAUDE.md from nestjs-rest-api template

Next: run /scaffold to generate your first feature module.
```

## Related

- `/scaffold` -- Generate feature modules, controllers, services
- `/verify` -- Run full health check before first commit
