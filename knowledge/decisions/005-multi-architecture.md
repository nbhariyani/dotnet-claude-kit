# ADR-005: Multi-Architecture Support

## Status

Accepted (supersedes [ADR-001](001-vsa-default.md))

## Context

Treating one architecture as the answer for every NestJS project creates bad guidance. Real projects vary by:

- domain complexity
- team size
- system lifetime
- deployment model
- number of bounded contexts

## Decision

**`nestjs-claude-kit` supports multiple architectures as first-class options, with the architecture advisor recommending the best fit.**

Supported choices:

| Architecture | Best For |
|---|---|
| Feature Modules | straightforward APIs, CRUD-heavy systems, small teams |
| Clean Architecture | longer-lived systems needing stronger separation |
| DDD + Clean Architecture | complex domains with rich invariants and language |
| Modular Monolith | multiple bounded contexts under one deployable system |

## Consequences

### Positive

- guidance matches more real-world NestJS systems
- users are less likely to get forced into the wrong shape
- evolution paths become explicit instead of accidental

### Negative

- more concepts and skills must be maintained
- users can face choice overload if no recommendation is given

## Mitigations

- use the architecture advisor before architecture-specific guidance
- recommend Feature Modules for simple or still-unclear systems
- keep each architecture's guidance self-contained and opinionated
