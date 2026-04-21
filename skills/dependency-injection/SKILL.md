---
name: dependency-injection
description: >
  NestJS dependency injection patterns covering providers, module scope,
  custom providers (useFactory, useValue, useClass), injection tokens,
  optional dependencies, and circular injection prevention.
  Load this skill when wiring up services, configuring providers, using
  custom tokens, or when the user mentions "injectable", "provider",
  "module", "useFactory", "useValue", "useClass", "inject token",
  "circular dependency", "scope", "transient", "REQUEST scope", or "DI".
---

# Dependency Injection (NestJS)

## Core Principles

1. **@Injectable() marks a class as a provider** — Any class decorated with
   `@Injectable()` can be injected. Registration in `module.providers[]` makes
   it available within that module's scope.
2. **Module exports control visibility** — A provider is only available to other
   modules when explicitly listed in `exports[]`. Never import a service class
   directly across module boundaries — import the module instead.
3. **Default scope is Singleton** — One instance per application lifetime. Use
   `REQUEST` scope sparingly (new instance per HTTP request, expensive). Use
   `TRANSIENT` when every injection needs a fresh instance.
4. **useFactory for async initialization** — When a provider depends on config,
   a database connection, or async setup, use `useFactory` with `async`.
5. **Symbol injection tokens prevent string key conflicts** — Use `Symbol` or
   typed `InjectionToken` constants instead of raw strings like `'DATABASE'`.

## Patterns

### Standard Provider Registration

```typescript
// orders/orders.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService], // only export what other modules need
})
export class OrdersModule {}
```

### Custom Provider with useFactory (Async)

```typescript
// database/database.providers.ts
export const DATABASE_PROVIDER = Symbol('DATABASE_PROVIDER');

export const databaseProviders = [
  {
    provide: DATABASE_PROVIDER,
    useFactory: async (config: ConfigService): Promise<DataSource> => {
      const dataSource = new DataSource({
        type: 'postgres',
        url: config.getOrThrow('DATABASE_URL'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
      });
      return dataSource.initialize();
    },
    inject: [ConfigService],
  },
];

// Usage in any service
constructor(@Inject(DATABASE_PROVIDER) private dataSource: DataSource) {}
```

### useValue for Constants and Test Doubles

```typescript
// Config constant
export const APP_CONFIG = Symbol('APP_CONFIG');
export interface AppConfig { maxRetries: number; timeoutMs: number; }

{ provide: APP_CONFIG, useValue: { maxRetries: 3, timeoutMs: 5000 } satisfies AppConfig }

// In tests — replace real service with mock
Test.createTestingModule({
  providers: [
    OrdersService,
    {
      provide: getRepositoryToken(Order),
      useValue: { save: jest.fn(), findOne: jest.fn() },
    },
  ],
});
```

### useClass for Strategy/Implementation Swapping

```typescript
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useClass: process.env.NODE_ENV === 'test'
        ? MockPaymentGateway
        : StripePaymentGateway,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentModule {}
```

### Provider Scope

```typescript
import { Injectable, Scope } from '@nestjs/common';

@Injectable()                                        // default: singleton
export class OrdersService {}

@Injectable({ scope: Scope.REQUEST })                // new instance per request
export class RequestContextService {
  constructor(@Inject(REQUEST) private request: Request) {}
  get userId(): string { return this.request['user']?.userId; }
}

@Injectable({ scope: Scope.TRANSIENT })              // new instance per injection
export class LoggerService {}
```

### forwardRef for Unavoidable Circular Dependencies

Restructure to break the cycle first. Use `forwardRef` only as a last resort.

```typescript
@Injectable()
export class OrdersService {
  constructor(
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}
}
```

### Optional Dependencies

```typescript
@Injectable()
export class NotificationService {
  constructor(
    @Optional() @Inject('PUSH_PROVIDER')
    private readonly pushProvider?: PushProvider,
  ) {}

  send(message: string) {
    this.pushProvider?.send(message);
  }
}
```

## Anti-patterns

### Don't Import Services Directly Across Module Boundaries

```typescript
// BAD — bypasses module encapsulation
import { PaymentsService } from '../payments/payments.service';

@Module({
  providers: [OrdersService, PaymentsService], // ← wrong module
})

// GOOD — import the module, use its exports
@Module({
  imports: [PaymentsModule],
  providers: [OrdersService],
})
```

### Don't Use Raw String Injection Tokens

```typescript
// BAD — typo-prone, no type safety
{ provide: 'database', useFactory: ... }
constructor(@Inject('database') private db: DataSource) {}

// GOOD — Symbol constant
export const DATABASE = Symbol('DATABASE');
{ provide: DATABASE, useFactory: ... }
constructor(@Inject(DATABASE) private db: DataSource) {}
```

### Don't Use REQUEST Scope Unnecessarily

```typescript
// BAD — REQUEST scope propagates up the entire dependency tree
@Injectable({ scope: Scope.REQUEST })
export class OrdersService {} // doesn't actually need request data

// GOOD — only the leaf service that reads REQUEST gets the scope
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private request: Request) {}
}
```

### Don't Use app.get() Outside Bootstrap

```typescript
// BAD — service locator pattern
const service = app.get(OrdersService);
service.doSomething(); // called from business logic

// GOOD — inject via constructor
constructor(private readonly ordersService: OrdersService) {}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Standard service | `@Injectable()` + `providers[]` |
| Async initialization (DB, config) | `useFactory` with `async` |
| Environment-based implementation | `useClass` with conditional |
| Test double / constant value | `useValue` |
| Cross-module sharing | `exports[]` in source + `imports[]` in consumer |
| Request-scoped data | `Scope.REQUEST` only on the service that reads `REQUEST` |
| Circular deps (unavoidable) | `forwardRef()` — then refactor to remove it |
