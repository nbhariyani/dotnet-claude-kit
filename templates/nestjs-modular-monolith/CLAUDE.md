# NestJS Modular Monolith — Project Instructions

> Drop this file into your NestJS project root. Claude will follow these instructions automatically.

## Project Type

NestJS Modular Monolith. Domain Modules architecture with strict boundary enforcement. TypeScript strict mode. TypeORM migrations.

## What Makes This a Modular Monolith

- **Hard module boundaries** enforced via `exports[]` — no cross-domain service imports
- **Integration events** for cross-domain communication (BullMQ or EventEmitter2)
- **Shared kernel** (`common/`) for cross-cutting concerns only
- Deployable as a single process; modules can be extracted to microservices later

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11+, `@nestjs/platform-express` |
| Language | TypeScript 5.x, strict mode |
| ORM | TypeORM + `@nestjs/typeorm` |
| Messaging | `@nestjs/bullmq` + `bullmq` (async cross-domain events) |
| Config | `@nestjs/config` + Joi schema validation |
| Logging | `nestjs-pino` + `pino-http` |
| Validation | `class-validator` + `class-transformer` |
| Auth | `@nestjs/passport`, `passport-jwt`, `@nestjs/jwt` |
| Health | `@nestjs/terminus` |
| Security | `helmet`, `@nestjs/throttler` |
| Testing | Jest, SuperTest, `@testcontainers/postgresql` |
| Package manager | pnpm |

## Project Structure

```
src/
  app.module.ts               ← imports domain modules + infrastructure
  main.ts                     ← bootstrap
  orders/                     ← Orders domain
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    orders.processor.ts       ← BullMQ processor for async jobs
    domain/
      order.entity.ts
      order-created.event.ts  ← integration event definition
    dto/
    application/
      place-order.command.ts
  payments/                   ← Payments domain
    payments.module.ts
    payments.service.ts
    payments.processor.ts
    domain/
    dto/
  notifications/              ← Notifications domain (consumes events)
    notifications.module.ts
    notifications.processor.ts
  common/                     ← Shared kernel — cross-cutting only
    filters/
    interceptors/
    guards/
    decorators/
    dto/
      pagination.dto.ts
  infrastructure/
    database/
      database.module.ts      ← TypeOrmModule.forRootAsync
      data-source.ts
    cache/
      cache.module.ts
    queue/
      queue.module.ts         ← BullMQModule registration
```

## Domain Boundary Rules

These rules are NON-NEGOTIABLE. Violating them defeats the modular monolith pattern.

- **Cross-domain calls via events only** — `OrdersService` must NOT import `PaymentsService`
- **No shared entities across domains** — each domain owns its data
- **`exports[]` is the public API of a module** — only export what other modules need
- **Never import a service class directly from another domain** — import the module

```typescript
// WRONG — direct cross-domain import
import { PaymentsService } from '../payments/payments.service';

// RIGHT — publish an integration event; Payments domain subscribes
await this.eventEmitter.emitAsync('order.created', new OrderCreatedEvent(order));
// or
await this.ordersQueue.add('process-payment', { orderId: order.id });
```

## Integration Events (Cross-Domain Communication)

Use BullMQ for durable async events or EventEmitter2 for in-process sync events.

```typescript
// Publisher (orders domain)
@Injectable()
export class OrdersService {
  constructor(
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
  ) {}

  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.ordersRepo.save(/* ... */);
    await this.paymentsQueue.add('charge', { orderId: order.id, amount: order.total });
    return order;
  }
}

// Consumer (payments domain)
@Processor('payments')
export class PaymentsProcessor {
  @Process('charge')
  async handleCharge(job: Job<{ orderId: string; amount: number }>) {
    await this.paymentsService.charge(job.data);
  }
}
```

## Global Setup (main.ts)

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.use(helmet());
app.enableCors({ origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(',') });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new AllExceptionsFilter());
app.setGlobalPrefix('api/v1');
```

## Database

- **One schema, per-domain table prefixes** (`orders_*`, `payments_*`) to signal ownership
- **Never `synchronize: true`** — always TypeORM CLI migrations
- **Transactions span one domain only** — cross-domain consistency via sagas/compensation

```typescript
// Domain-prefixed table naming
@Entity('orders_orders')
export class Order { ... }

@Entity('payments_charges')
export class Charge { ... }
```

## Authentication

- **`APP_GUARD` + `@Public()` pattern** — all endpoints protected by default

```typescript
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

## Error Handling

- Throw typed `HttpException` subclasses from services
- Global `AllExceptionsFilter` in `main.ts`
- No try-catch in controllers

## Testing Strategy

1. **E2E tests per domain** — SuperTest + Testcontainers, test the domain's HTTP surface
2. **Integration tests for processors** — spin up BullMQ with real Redis (Testcontainers)
3. **Unit tests** for domain logic with `createTestingModule`

```typescript
// Domain E2E test
describe('Orders Domain (e2e)', () => {
  let app: INestApplication;
  let pgContainer: StartedPostgreSqlContainer;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer().start();
    // ... bootstrap with real DB
  });
});
```

## Skills to Load

- `modern-typescript`
- `feature-modules` — module boundaries, `exports[]`
- `dependency-injection` — provider wiring
- `messaging` — BullMQ, EventEmitter2
- `typeorm` — entities, migrations
- `authentication` — guards, JWT
- `error-handling` — filter, HttpException
- `testing` — E2E, Testcontainers

## Agents to Use

- `/nestjs-architect` — Domain boundary design, event modeling
- `/orm-specialist` — TypeORM, domain-prefixed tables, transactions
- `/test-engineer` — Cross-domain integration tests
- `/security-auditor` — Auth, validation, security headers
