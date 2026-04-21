---
alwaysApply: true
description: >
  NestJS error handling rules: HttpException hierarchy, ExceptionFilter,
  no try-catch in controllers, and ProblemDetails response format.
---

# Error Handling Rules (NestJS)

## HttpException Over Generic Error

- **DO** throw typed `HttpException` subclasses from services for expected failures.
  Rationale: Typed exceptions map to correct HTTP status codes automatically and make
  failure modes explicit in the service contract.

- **DON'T** throw `new Error(...)` from services.
  Rationale: Generic errors become unhandled 500s and hide the actual failure category.

```typescript
// DO
throw new NotFoundException(`Order ${id} not found`);
throw new ConflictException('Order already shipped');
throw new BadRequestException('Invalid payment method');

// DON'T
throw new Error('not found');
```

## Global ExceptionFilter Is Mandatory

- **DO** register a global `ExceptionFilter` in `main.ts` before `app.listen()`.
  Rationale: Without it, unhandled exceptions leak stack traces and internal details
  to clients in production.

```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

- **DON'T** rely on NestJS's default error format for production.
  Rationale: Default format is not RFC 9457 ProblemDetails-compliant.

## Controllers Never Catch

- **DON'T** use try-catch in controllers.
  Rationale: Controllers are thin HTTP adapters. Exception handling belongs in the filter.

```typescript
// DON'T
@Get(':id')
async findOne(@Param('id') id: string) {
  try { return await this.service.findById(id); }
  catch { throw new NotFoundException(); }
}

// DO — let the filter handle it
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}
```

## ValidationPipe Is Mandatory

- **DO** register `ValidationPipe` globally in `main.ts` with `whitelist: true`.
  Rationale: Unvalidated input reaching services is the primary source of security
  vulnerabilities and data corruption.

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

## Quick Reference

| Scenario | Approach |
|---|---|
| Resource not found | `throw new NotFoundException(...)` |
| Input validation failed | `ValidationPipe` + `BadRequestException` |
| Duplicate / state conflict | `throw new ConflictException(...)` |
| Not authenticated | `throw new UnauthorizedException(...)` |
| Not authorized | `throw new ForbiddenException(...)` |
| Multiple named domain failures | `neverthrow` Result pattern |
| Unexpected crash | Global filter catches, logs, returns 500 |
