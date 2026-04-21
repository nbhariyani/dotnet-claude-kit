---
name: project-structure
description: >
  NestJS project layout and organization patterns. Load this skill when deciding
  folder structure, organizing a monorepo, configuring nest-cli.json, setting up
  barrel exports, or restructuring an existing project layout.
---

## Core Principles

1. **Feature-first, not layer-first.** Group by domain (`orders/`, `users/`) rather
   than by type (`controllers/`, `services/`). All files for a feature live together,
   making it easier to find, delete, or extract a feature.

2. **One module per feature.** Each feature folder has exactly one `*.module.ts` that
   owns its providers and explicitly declares what it exports.

3. **Barrel exports per module.** A `index.ts` at the feature root re-exports the
   public surface. Consumers import from the barrel, not from nested paths.

4. **`common/` for shared infrastructure.** Guards, interceptors, pipes, and filters
   that cross feature boundaries live in `src/common/`, not inside any feature folder.

5. **Nx for multi-app or multi-lib monorepos.** For single-app projects, the standard
   NestJS `src/` layout is sufficient. Add Nx only when you need multiple deployable
   apps or genuinely shared libraries.

## Patterns

### Standard Single-App Structure

```
src/
  app.module.ts
  main.ts
  common/
    filters/
      all-exceptions.filter.ts
    guards/
      jwt-auth.guard.ts
    interceptors/
      logging.interceptor.ts
    pipes/
      parse-uuid.pipe.ts
  config/
    configuration.ts          # registerAs factories
    validation.schema.ts      # Joi schema
  orders/
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    dto/
      create-order.dto.ts
      update-order.dto.ts
      order-response.dto.ts
    entities/
      order.entity.ts
    orders.controller.spec.ts
    orders.service.spec.ts
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    ...
test/
  orders.e2e-spec.ts
  users.e2e-spec.ts
```

### Barrel Export per Feature

```typescript
// src/orders/index.ts
export { OrdersModule } from './orders.module';
export { OrdersService } from './orders.service';
export { CreateOrderDto } from './dto/create-order.dto';
export { OrderResponseDto } from './dto/order-response.dto';

// Consuming module imports from barrel
import { OrdersModule } from '../orders';
```

### nest-cli.json Configuration

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "introspectComments": true,
          "classValidatorShim": true
        }
      }
    ]
  }
}
```

### Nx Monorepo Layout

```
apps/
  api/                        # main NestJS app
    src/
      app.module.ts
      main.ts
  worker/                     # BullMQ worker process
    src/
      worker.module.ts
      main.ts
libs/
  shared/
    src/
      lib/
        dto/
        entities/
        utils/
      index.ts                # public API of the lib
  auth/
    src/
      lib/
        auth.module.ts
        jwt.strategy.ts
      index.ts
nx.json
workspace.json
```

```bash
# Generate Nx app
npx nx generate @nx/nest:app worker

# Generate Nx lib
npx nx generate @nx/nest:lib auth
```

## Anti-patterns

### Layer-First Structure

```
# BAD — all controllers together, all services together
src/
  controllers/
    orders.controller.ts
    users.controller.ts
  services/
    orders.service.ts
    users.service.ts
  entities/
    order.entity.ts
    user.entity.ts

# GOOD — feature-first
src/
  orders/
    orders.controller.ts
    orders.service.ts
    entities/order.entity.ts
  users/
    users.controller.ts
    users.service.ts
    entities/user.entity.ts
```

### Deep Relative Imports Across Features

```typescript
// BAD — fragile path, bypasses barrel
import { OrdersService } from '../../orders/orders.service';

// GOOD — import the module and use DI; or use the barrel
import { OrdersModule } from '../orders';
// Then inject OrdersService via NestJS DI after importing OrdersModule
```

### Shared Business Logic in AppModule

```typescript
// BAD — AppModule has providers that belong to a feature
@Module({
  imports: [TypeOrmModule.forFeature([Order, User])],
  providers: [OrdersService, UsersService],
})
export class AppModule {}

// GOOD — AppModule only imports feature modules
@Module({
  imports: [OrdersModule, UsersModule, ConfigModule.forRoot(...)],
})
export class AppModule {}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Single deployable NestJS API | Standard `src/` feature-first layout |
| Multiple NestJS apps sharing code | Nx monorepo with `apps/` + `libs/` |
| Shared guards/interceptors/filters | `src/common/` folder, not inside features |
| Cross-feature DTO sharing | `src/common/dto/` or a shared Nx lib |
| Growing monolith, extracting services | Feature-first makes extraction straightforward |
| Barrel export granularity | Export only what other modules need; keep internals private |
