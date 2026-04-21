---
name: architecture-advisor
description: >
  Guide users to the right NestJS architecture: Feature Modules (default), Clean
  Architecture, DDD, or Modular Monolith. Uses a questionnaire to match architecture
  to team and domain. Load when starting a new project, evaluating whether to
  restructure, or when asked which architecture to use.
  Trigger keywords: architecture, project structure, feature modules, clean architecture,
  DDD, modular monolith, how should I structure, folder structure, organize project.
---

## Core Principles

1. **Ask before recommending.** Never assume an architecture — gather context first.
   Three questions cover 80% of cases: team size, domain complexity, and deployment
   model. Rationale: the wrong architecture is harder to fix than no architecture.

2. **Feature Modules is the correct default.** It is what NestJS was designed for,
   has the lowest learning curve, and scales to medium-sized teams. Only move to
   something more complex when you have a clear reason. Rationale: premature
   architectural complexity is the most common waste in NestJS projects.

3. **Deployment model determines macro-architecture.** Single deployable → monolith
   (Feature Modules or Modular Monolith). Multiple deployables → microservices.
   Do not add microservices complexity without a concrete operational reason.

4. **Domain complexity drives micro-architecture.** Simple CRUD → Feature Modules.
   Complex invariants with multiple aggregates and domain events → DDD. Rationale:
   DDD overhead (aggregates, value objects, domain events) only pays off when the
   domain is genuinely complex.

5. **You can start simple and evolve.** Feature Modules can be refactored into Clean
   Architecture layers. Recommend the simplest architecture that fits today's needs,
   with a migration path if growth is expected.

## Questionnaire

Ask these questions before recommending:

1. **Team size?**
   - 1–3 engineers → Feature Modules
   - 4–10 engineers → Feature Modules or Modular Monolith
   - 10+ engineers on same repo → Modular Monolith with clear bounded contexts

2. **Domain complexity?**
   - Simple CRUD (e-commerce catalog, user management) → Feature Modules
   - Moderate rules (discount engine, order state machine) → Feature Modules or Clean Architecture
   - Complex domain (insurance underwriting, financial ledger) → DDD + Clean Architecture

3. **Deployment model?**
   - One deployable unit → Feature Modules or Modular Monolith
   - Multiple services with independent deployments → Microservices (each service still uses Feature Modules internally)

4. **Existing codebase or greenfield?**
   - Greenfield → choose based on above
   - Existing → incrementally apply the target architecture, module by module

## Patterns

### Feature Modules — recommended default

```
src/
  app.module.ts
  orders/
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    entities/order.entity.ts
    dto/create-order.dto.ts
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
  payments/
    payments.module.ts
    payments.service.ts
  common/
    common.module.ts
    filters/
    interceptors/
    guards/
    decorators/
  prisma/
    prisma.module.ts
    prisma.service.ts
  main.ts
```

Best for: 1–8 engineers, moderate domain complexity, single deployable.

### Clean Architecture (when domain logic is complex)

```
src/
  domain/            ← no framework dependencies
    orders/
      order.entity.ts
      order-item.value-object.ts
      orders.repository.ts    (interface)
      place-order.use-case.ts
  application/       ← use cases, DTOs
    orders/
      commands/create-order.handler.ts
      queries/get-order.query.ts
  infrastructure/    ← TypeORM, HTTP, external services
    persistence/
      typeorm-orders.repository.ts
    http/
      orders.controller.ts
      orders.module.ts
  main.ts
```

Best for: complex domain rules, multiple aggregates, need to swap infrastructure later.

### Modular Monolith (large team, single deployable)

```
src/
  modules/
    orders/          ← self-contained with own DB namespace
      orders.module.ts
    payments/
      payments.module.ts
    users/
      users.module.ts
  shared/
    events/          ← inter-module events (EventEmitter2)
    contracts/       ← shared DTOs and interfaces
  app.module.ts
```

Best for: 10+ engineers, bounded contexts, potential future extraction to microservices.

### DDD tactical patterns (overlay on any of the above)

```
src/
  orders/
    domain/
      order.aggregate.ts
      order-status.value-object.ts
      order-placed.event.ts
      orders.repository.ts     ← interface
    application/
      place-order.use-case.ts
    infrastructure/
      typeorm-orders.repository.ts
    orders.module.ts
```

Best for: rich domain logic, strong business invariants, event-driven processes.

## Anti-patterns

### Choosing microservices for a small team

```
// BAD — 3 engineers maintaining 8 services with independent deployments
services/
  orders-service/
  payments-service/
  notifications-service/
  ... (more services than engineers)

// GOOD — modular monolith, extract services only if deployment constraints require it
src/
  modules/
    orders/
    payments/
    notifications/
```

### Layer-folder structure

```
// BAD — related files scattered across the project
src/
  controllers/orders.controller.ts
  services/orders.service.ts
  entities/order.entity.ts

// GOOD — feature-folder groups related files
src/
  orders/
    orders.controller.ts
    orders.service.ts
    entities/order.entity.ts
```

## Decision Guide

| Team Size | Domain Complexity | Deployment | Recommendation |
|---|---|---|---|
| 1–5 | Simple CRUD | Single | Feature Modules |
| 1–5 | Moderate rules | Single | Feature Modules + Clean Architecture layers |
| 5–15 | Moderate | Single | Modular Monolith |
| 5–15 | Complex domain | Single | Modular Monolith + DDD per module |
| 15+ | Any | Single | Modular Monolith with bounded contexts |
| Any | Any | Multiple deployables | Microservices (each service = Feature Modules) |
| Any | Complex rules | Any | Clean Architecture + DDD tactical patterns |
