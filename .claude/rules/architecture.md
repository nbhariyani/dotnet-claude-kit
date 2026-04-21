---
alwaysApply: true
description: >
  NestJS module architecture rules: module boundaries, no circular imports,
  endpoint organization, project structure, and dependency direction.
---

# Architecture Rules (NestJS)

## Ask First, Recommend Second

- **Never assume an architecture — use the architecture-advisor skill.**
  Ask about team size, domain complexity, and deployment model before recommending
  Feature Modules, Clean Architecture, DDD, or Modular Monolith.

## Module Boundaries

- **Modules communicate via `exports[]` only.** Never import a service class directly
  from another module — import the module and use its exported providers.
  Rationale: Direct cross-module imports bypass NestJS DI scope and create invisible coupling.

```typescript
// DO — import the module, use its exported service
@Module({ imports: [PaymentsModule] })
export class OrdersModule {}

// DON'T — direct class import bypasses module encapsulation
import { PaymentsService } from '../payments/payments.service';
@Module({ providers: [OrdersService, PaymentsService] })
```

- **No circular module dependencies.** If two modules import each other, extract the
  shared concern into a third module. Use `forwardRef()` only as a last resort.
- **`@Global()` is a code smell.** Only `AppModule`-level infrastructure (config,
  logging, database) should be global. Never use `@Global()` on domain modules.

## Endpoint Organization

- **Every resource gets its own controller.** No `AppController` with business endpoints.
  `AppController` is for health checks and root metadata only.
- **No business logic in `AppModule`.** `AppModule` imports feature modules only.

```typescript
// DO — dedicated controller per resource
@Controller('orders')
export class OrdersController { ... }

// DON'T — endpoints crammed into AppController
@Controller()
export class AppController {
  @Get('orders') getOrders() { ... }
  @Get('users') getUsers() { ... }
}
```

## Project Structure

- **Feature folders over layer folders.** Related files stay together.

```
# DO                          # DON'T
src/                          src/
  orders/                       controllers/
    orders.controller.ts          orders.controller.ts
    orders.service.ts             users.controller.ts
    orders.module.ts            services/
    entities/order.entity.ts      orders.service.ts
    dto/create-order.dto.ts     entities/
  users/                          order.entity.ts
    users.controller.ts
    users.service.ts
    users.module.ts
```

## Dependency Direction

- **Controllers depend on Services. Services depend on Repositories / DataSource.**
  Services never import controllers. Repositories never import services.
- **Domain logic in services, not controllers.** Controllers extract HTTP input and
  return HTTP output. Nothing else.

## DO / DON'T Quick Reference

| DO | DON'T |
|---|---|
| Import modules, use their exports | Import service classes across module boundaries |
| `exports: [OrdersService]` when sharing | Forget to export — silent DI error |
| Feature-folder structure per domain | Layer-folder structure (controllers/, services/) |
| `@Global()` only for infrastructure | `@Global()` on domain modules |
| Thin controllers calling services | Business logic in controllers |
