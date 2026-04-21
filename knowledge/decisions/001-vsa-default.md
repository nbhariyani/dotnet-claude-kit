# ADR-001: Feature Modules as the Default

## Status

Superseded by [ADR-005](005-multi-architecture.md)

> Feature Modules remain a first-class pattern in `nestjs-claude-kit`, but they are no longer treated as the only default for every project.

## Context

`nestjs-claude-kit` needed a default architectural shape for typical NestJS applications. The main candidates were:

- **Feature Modules:** Organize by domain area such as `orders`, `users`, `billing`
- **Layer-first structure:** Global `controllers`, `services`, `repositories`, `dto` folders
- **Strict clean architecture from day one:** More boundaries, more ceremony

We evaluated them against:

1. AI-assisted development ergonomics
2. Feature delivery speed
3. Merge conflict likelihood
4. Fit for common NestJS conventions
5. Ability to evolve later

## Decision

**Feature Modules were chosen as the initial default structure.**

A typical feature module keeps related code close together:

```text
src/
  orders/
    dto/
    entities/
    orders.controller.ts
    orders.service.ts
    orders.module.ts
```

## Consequences

### Positive

- Related files stay close together
- New features are easier to add end to end
- Nest module boundaries stay visible
- This maps naturally to common REST API projects

### Negative

- Feature modules alone do not solve complex domain boundaries
- Teams can still leak logic across modules if they ignore exports/contracts
- Some larger systems outgrow the simplest feature-first structure

## Mitigations

- Use the architecture advisor for non-trivial systems
- Introduce stricter boundaries when domain complexity demands it
- Treat feature modules as a strong starting point, not a religion
