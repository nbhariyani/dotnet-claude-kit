---
description: >
  Generate NestJS modules, controllers, services, guards, pipes, or filters using
  the Nest CLI. Architecture-aware — places files in the correct location for Feature
  Modules or Clean Architecture. Triggers on: "create a module", "add a controller",
  "generate a service", "scaffold orders feature", "add guard", "new pipe", "create filter".
---

# /scaffold

## What

Runs `nest g` CLI commands for the requested component type. Understands the project's
architecture pattern (Feature Modules vs Clean Architecture) and places files in the
right directory. For full features, generates the complete slice: module + controller
+ service + DTOs.

## When

- "create a module"
- "add a controller"
- "generate a service"
- "scaffold orders feature" (full feature slice)
- "add guard", "new pipe", "create filter"
- Any new NestJS component that should follow the project's established pattern

## How

### Step 1: Identify Component Type

If the request is ambiguous, ask once: "What should I scaffold — a full feature module,
or a specific component (controller / service / guard / pipe / filter)?"

### Step 2: Run Nest CLI Commands

**Full feature module (most common):**

```bash
nest g module orders
nest g controller orders --no-spec
nest g service orders --no-spec
```

Then manually create DTOs in `src/orders/dto/`:
- `create-order.dto.ts` — with `class-validator` decorators and `@ApiProperty`
- `update-order.dto.ts` — extends `PartialType(CreateOrderDto)`
- `order-response.dto.ts` — response shape (no entity exposure)

**Single component:**

```bash
nest g guard common/guards/jwt-auth          # guard
nest g pipe common/pipes/parse-object-id     # pipe
nest g filter common/filters/http-exception  # filter
nest g interceptor common/interceptors/logging  # interceptor
```

### Step 3: Register in AppModule

Add the new feature module to `AppModule.imports[]`:

```typescript
@Module({
  imports: [OrdersModule, UsersModule],
})
export class AppModule {}
```

### Step 4: Verify

Run `get_diagnostics` (or `npx tsc --noEmit`) to confirm no TypeScript errors were
introduced by the scaffolding.

## Example

```bash
# Scaffold a full orders feature
nest g module orders
nest g controller orders --no-spec
nest g service orders --no-spec

# Created:
#   src/orders/orders.module.ts
#   src/orders/orders.controller.ts
#   src/orders/orders.service.ts
#   src/orders/dto/create-order.dto.ts      (generated)
#   src/orders/dto/update-order.dto.ts      (generated)
#   src/orders/dto/order-response.dto.ts    (generated)
```

## Related

- `/nest-init` -- Bootstrap the project before scaffolding features
- `/tdd` -- Write tests alongside the scaffolded code
