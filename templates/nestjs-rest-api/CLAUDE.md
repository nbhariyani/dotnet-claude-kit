# NestJS REST API — Project Instructions

> Drop this file into your NestJS project root. Claude will follow these instructions automatically.

## Project Type

NestJS REST API. Feature Modules architecture. TypeScript strict mode. TypeORM (default ORM).

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11+, `@nestjs/platform-express` |
| Language | TypeScript 5.x, strict mode |
| ORM | TypeORM + `@nestjs/typeorm` |
| Validation | `class-validator` + `class-transformer` |
| Auth | `@nestjs/passport`, `passport-jwt`, `@nestjs/jwt` |
| Config | `@nestjs/config` + Joi schema validation |
| Swagger | `@nestjs/swagger`, `swagger-ui-express` |
| Logging | `nestjs-pino` + `pino-http` |
| Health | `@nestjs/terminus` |
| Security | `helmet`, `@nestjs/throttler` |
| Testing | Jest, SuperTest, `@testcontainers/postgresql` |
| Package manager | pnpm |

## Architecture: Feature Modules

Each domain lives in its own module folder. Modules are the unit of encapsulation.

```
src/
  app.module.ts          ← imports feature modules only
  main.ts                ← bootstrap, global middleware
  orders/
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    dto/
      create-order.dto.ts
      order-response.dto.ts
    entities/
      order.entity.ts
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    dto/
    entities/
  common/
    filters/
      all-exceptions.filter.ts
    interceptors/
      logging.interceptor.ts
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
    decorators/
      current-user.decorator.ts
      public.decorator.ts
      roles.decorator.ts
    dto/
      pagination.dto.ts
```

## Global Setup (main.ts)

Every project must configure these in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.use(helmet());
app.enableCors({ origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(',') });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new AllExceptionsFilter());
app.setGlobalPrefix('api/v1');
```

## Module Rules

- **Modules share services via `exports[]` only** — never import a service class directly from another module
- **No circular module imports** — extract shared concerns into a `CommonModule` or `SharedModule`
- **`@Global()` only for infrastructure** — config, logging, database connection; never on domain modules
- **`AppModule` imports feature modules only** — no business logic in `AppModule`

## Controller Rules

- **Thin controllers** — extract HTTP input, call service, return response DTO
- **No business logic in controllers** — all logic lives in services
- **Use DTOs for all input and output** — never expose entities directly
- **Apply `ParseUUIDPipe` on `:id` params**

```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
  return this.ordersService.findById(id);
}
```

## Authentication

- **`APP_GUARD` + `@Public()` pattern** — every endpoint is protected by default; use `@Public()` to opt out
- **`@Roles()` on all admin/privileged routes**
- **Short-lived access tokens + refresh-token rotation** — use this when the API supports long-lived sessions
- **Keep auth logic in strategies, guards, and auth services** — not in controllers or interceptors

```typescript
// app.module.ts providers
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

## Validation

- `ValidationPipe` globally applied (see Global Setup)
- All DTOs use `class-validator` decorators
- `whitelist: true` strips unknown properties before they reach services

```typescript
export class CreateOrderDto {
  @IsUUID() customerId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}
```

## Error Handling

- **Throw typed `HttpException` subclasses** from services (`NotFoundException`, `ConflictException`, etc.)
- **Never throw `new Error()`** from services
- **No try-catch in controllers** — the global filter handles all exceptions
- **Global `AllExceptionsFilter`** registered in `main.ts`

## Database

- **Never use `synchronize: true` outside local dev** — always use migrations in production
- **Use migrations**: `typeorm migration:generate` / `typeorm migration:run`
- **Review generated migrations before committing** — generated SQL is a starting point, not an authority
- **Inject `Repository<Entity>` via `@InjectRepository()`**
- **No N+1** — use `relations` option or `QueryBuilder` with joins

## Seeds

- Add seed scripts when the project needs demo data, local bootstrap data, or stable test accounts
- Keep seed logic idempotent where practical so local setup is repeatable
- Treat seeds as environment support tooling, not as a substitute for migrations
- Document how to run seeds in `README.md` or project onboarding notes

## TypeORM DataSource (data-source.ts)

This is one of the few places where direct environment reads are acceptable. Application services should still use `ConfigService`.

```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
});
```

## Logging

- Use `nestjs-pino` — no `console.log` anywhere
- Use `Logger` from `@nestjs/common` in services
- **Never log PII** (emails, tokens, passwords) at `info` level or above

## Swagger

- Decorate all DTOs with `@ApiProperty()`
- Use `DocumentBuilder` in `main.ts`
- `@ApiTags()` on every controller
- Generate the OpenAPI spec in CI when client generation or spec diffing matters

## Testing Strategy

1. **E2E tests first** for HTTP endpoints — SuperTest + Testcontainers PostgreSQL
2. **Unit tests** for service logic with `createTestingModule` + mock repositories
3. Apply same global pipes/filters in test setup as production
4. Run migrations before E2E tests when the suite depends on real schema state

```typescript
// E2E setup
const container = await new PostgreSqlContainer().start();
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
app.useGlobalFilters(new AllExceptionsFilter());
await app.init();
```

## Skills to Load

When working on this project, ask Claude to load:

- `modern-typescript` — TypeScript patterns and idioms
- `controllers` — Controller structure, DTOs, pipes
- `dependency-injection` — Module wiring, providers, tokens
- `authentication` — Guards, strategies, JWT
- `typeorm` — Entities, repositories, migrations
- `error-handling` — HttpException hierarchy, global filter
- `testing` — Jest, SuperTest, Testcontainers
- `openapi` — Swagger decorators, DocumentBuilder

## Agents to Use

- `/nestjs-architect` — Architecture decisions, module structure
- `/api-designer` — Controller design, DTO design, Swagger
- `/orm-specialist` — TypeORM entities, migrations, queries
- `/test-engineer` — Test setup, E2E and unit test writing
- `/security-auditor` — Auth, validation, security headers
