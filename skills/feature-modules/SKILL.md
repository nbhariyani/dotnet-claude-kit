---
name: feature-modules
description: >
  NestJS Feature Modules architecture: one module per domain, providers shared via
  exports[], no circular imports, @Global() only for infrastructure. Load when
  scaffolding a new feature, organizing modules, or resolving DI errors caused by
  missing exports or cross-module imports.
  Trigger keywords: module, feature module, exports, imports, providers, DI scope,
  circular dependency, @Global.
---

## Core Principles

1. **Modules are the unit of encapsulation.** Every domain (orders, users, payments)
   gets its own module. No domain logic in AppModule. Rationale: modules enforce
   explicit dependency declarations and prevent unintended coupling.

2. **Cross-module sharing via `exports[]` only.** Import the module, consume its
   exported providers. Never import a service class directly from another module.
   Rationale: direct class imports bypass NestJS DI scope and create invisible coupling.

3. **AppModule is a registry, not a feature.** It imports feature modules and
   infrastructure modules only — no controllers, no business providers.
   Rationale: keeps the application entry point clean and all domain logic findable
   by module name.

4. **`@Global()` is a code smell for domain modules.** Use it only for
   infrastructure modules (ConfigModule, LoggerModule, PrismaModule) that every
   feature genuinely needs. Rationale: @Global hides dependencies — callers don't
   declare what they consume.

5. **No circular module dependencies.** If two modules need each other, extract the
   shared concern into a third module. `forwardRef()` is a last resort that signals
   a design problem. Rationale: circular deps cause provider initialization failures
   and obscure the dependency graph.

## Patterns

### Full feature module

```
src/orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  entities/
    order.entity.ts
  dto/
    create-order.dto.ts
    update-order.dto.ts
  repositories/
    orders.repository.ts
```

```typescript
// orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { Order } from './entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService], // only export what other modules need
})
export class OrdersModule {}
```

### Cross-module service sharing via exports[]

```typescript
// payments.module.ts
@Module({
  providers: [PaymentsService],
  exports: [PaymentsService], // required to allow other modules to inject it
})
export class PaymentsModule {}

// orders.module.ts — import the MODULE, not the class
@Module({
  imports: [PaymentsModule], // NestJS wires PaymentsService into the DI container
  providers: [OrdersService],
})
export class OrdersModule {}

// orders.service.ts — inject as normal
@Injectable()
export class OrdersService {
  constructor(private readonly paymentsService: PaymentsService) {}
}
```

### Shared/Common module for cross-cutting concerns

```typescript
// common/common.module.ts
@Module({
  providers: [AuditService, DateService, CryptoService],
  exports: [AuditService, DateService, CryptoService],
})
export class CommonModule {}

// Any feature module that needs audit:
@Module({
  imports: [CommonModule],
  providers: [OrdersService],
})
export class OrdersModule {}
```

### TypeORM forFeature() pattern

```typescript
// Each feature module registers only its own entities
@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem])],
  providers: [OrdersService],
})
export class OrdersModule {}
```

### Infrastructure @Global module (the valid use case)

```typescript
// database/database.module.ts
@Global() // justified — every feature needs TypeORM DataSource
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

### AppModule — registry only

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LoggerModule.forRoot(),
    OrdersModule,
    UsersModule,
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule {}
```

## Anti-patterns

### Direct cross-module class import

```typescript
// BAD — bypasses DI, creates invisible coupling
import { PaymentsService } from '../payments/payments.service';

@Module({
  providers: [OrdersService, PaymentsService], // PaymentsService not in PaymentsModule scope
})
export class OrdersModule {}

// GOOD — import the module, use its exported provider
@Module({
  imports: [PaymentsModule],
  providers: [OrdersService],
})
export class OrdersModule {}
```

### @Global on a domain module

```typescript
// BAD — hides that OrdersModule depends on UserModule
@Global()
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}

// GOOD — explicit import makes the dependency visible
@Module({
  imports: [UsersModule], // clear, auditable dependency
  providers: [OrdersService],
})
export class OrdersModule {}
```

### Business logic in AppModule

```typescript
// BAD
@Module({
  providers: [OrdersService, PaymentsService], // all providers dumped in root
  controllers: [OrdersController],
})
export class AppModule {}

// GOOD
@Module({
  imports: [OrdersModule, PaymentsModule], // AppModule only wires modules together
})
export class AppModule {}
```

### Forgetting to export a provider

```typescript
// BAD — OrdersService cannot inject PaymentsService (no export)
@Module({ providers: [PaymentsService] }) // exports[] omitted
export class PaymentsModule {}

// GOOD
@Module({
  providers: [PaymentsService],
  exports: [PaymentsService], // explicit export enables consumers
})
export class PaymentsModule {}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New domain feature (orders, users) | New `@Module()` with feature folder |
| Service needed by multiple modules | Export from its module; import that module |
| Infrastructure needed app-wide | `@Global()` module (ConfigModule, Logger, DB) |
| Two modules importing each other | Extract shared concern into third module |
| Circular import unavoidable | `forwardRef()` as last resort — then refactor |
| Utility classes (date, crypto, audit) | CommonModule, export all utilities |
| Feature entity registration | `TypeOrmModule.forFeature([Entity])` per feature module |
