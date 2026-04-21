# ADR-002: Explicit Failure Contracts Over Control-Flow Exceptions

## Status

Accepted

## Context

Applications need a consistent strategy for expected failures such as:

- entity not found
- validation failed
- conflict/duplicate
- business rule violation
- forbidden action

The two common approaches are:

1. Throw exceptions for expected failures
2. Return explicit failure values or map failures intentionally at the boundary

## Decision

**Expected failures should be expressed explicitly where possible, rather than relying on exceptions as routine control flow.**

In NestJS projects this usually means one of two styles:

- service returns a typed result/error union
- service throws a deliberate domain/app error that is mapped consistently by a filter or controller boundary

What we want to avoid is hidden, incidental exception-driven flow for routine outcomes.

## Guidance

### Prefer explicit failure contracts for:

- not found
- validation or precondition failures
- domain rule violations
- duplicate/conflict cases

### Reserve exceptions for:

- unexpected infrastructure failures
- programmer errors
- library/runtime failures
- truly exceptional conditions

## Consequences

### Positive

- method contracts become easier to reason about
- failure handling is more consistent
- controller/filter mapping becomes intentional
- AI-generated code is less likely to hide failure paths

### Negative

- some extra ceremony is introduced
- teams need to stay consistent about error shape and mapping

## Mitigations

- provide one standard app error shape
- provide one standard exception/result mapping pattern
- avoid mixing ad hoc strategies within the same module
