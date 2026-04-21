---
name: filters
description: >
  NestJS Exception Filters: @Catch, ArgumentsHost, HttpException, AllExceptionsFilter,
  ProblemDetails RFC 9457. Load when setting up error handling, customizing error
  responses, catching domain-specific exceptions, or eliminating stack trace leaks.
  Trigger keywords: filter, ExceptionFilter, @Catch, AllExceptionsFilter, error
  response, ProblemDetails, RFC 9457, stack trace, exception handling, 500 error.
---

## Core Principles

1. **A global filter is mandatory before `app.listen()`.** Rationale: without it,
   unhandled exceptions produce NestJS's default error format which leaks internal
   details and is not standards-compliant.

2. **Never expose stack traces in production.** Rationale: stack traces reveal file
   paths, library versions, and business logic — a reconnaissance gift for attackers.
   Use `NODE_ENV` to control inclusion.

3. **Return RFC 9457 ProblemDetails format.** The standard fields: `type`, `title`,
   `status`, `detail`, `instance`. Rationale: clients and API gateways expect a
   consistent error contract; ProblemDetails is the IETF standard for HTTP errors.

4. **Catch specific exception types before the catch-all.** Register type-specific
   filters (TypeORM `EntityNotFoundError`, domain errors) to map them precisely.
   Rationale: a single `AllExceptionsFilter` that handles everything via `instanceof`
   chains is hard to extend and test.

5. **No try-catch in controllers.** Controllers are HTTP adapters — exception handling
   belongs in filters. Rationale: try-catch in controllers duplicates filter logic and
   hides errors from the global pipeline (logging, metrics).

## Patterns

### AllExceptionsFilter with ProblemDetails (RFC 9457)

```typescript
// common/filters/all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  stack?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const detail =
      exception instanceof HttpException
        ? this.resolveMessage(exception)
        : 'An unexpected error occurred';

    const isProduction = this.config.get('NODE_ENV') === 'production';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ProblemDetails = {
      type: `https://httpstatuses.io/${status}`,
      title: HttpStatus[status] ?? 'Error',
      status,
      detail,
      instance: request.url,
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { stack: exception instanceof Error ? exception.stack : undefined }),
    };

    response.status(status).json(body);
  }

  private resolveMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null) {
      const r = response as Record<string, unknown>;
      if (Array.isArray(r['message'])) return (r['message'] as string[]).join('; ');
      if (typeof r['message'] === 'string') return r['message'];
    }
    return exception.message;
  }
}
```

### Register globally in main.ts

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalFilters(new AllExceptionsFilter(config));

  await app.listen(3000);
}

bootstrap();
```

### Domain-specific filter: TypeORM EntityNotFoundError → 404

```typescript
// common/filters/entity-not-found.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import type { Response } from 'express';

@Catch(EntityNotFoundError)
export class EntityNotFoundFilter implements ExceptionFilter {
  catch(exception: EntityNotFoundError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const notFound = new NotFoundException(exception.message);
    response.status(404).json({
      type: 'https://httpstatuses.io/404',
      title: 'Not Found',
      status: 404,
      detail: exception.message,
    });
  }
}

// Register alongside AllExceptionsFilter (specific filters run first):
app.useGlobalFilters(new EntityNotFoundFilter(), new AllExceptionsFilter(config));
```

### HttpExceptionFilter (HttpException only)

```typescript
// common/filters/http-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    this.logger.warn(`${request.method} ${request.url} → ${status}: ${exception.message}`);

    response.status(status).json({
      type: `https://httpstatuses.io/${status}`,
      title: exception.name,
      status,
      detail: exception.message,
      instance: request.url,
    });
  }
}
```

## Anti-patterns

### try-catch in controllers

```typescript
// BAD — duplicates filter logic, hides errors from global logging
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string) {
  try {
    return await this.service.findById(id);
  } catch {
    throw new NotFoundException();
  }
}

// GOOD — service throws NotFoundException, filter handles the response
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}
```

### No global filter (stack traces leak in production)

```typescript
// BAD — NestJS default exposes stack trace and internal paths
// No filter registered → {"statusCode":500,"message":"Internal server error"}
// ... plus full stack trace in some cases

// GOOD
app.useGlobalFilters(new AllExceptionsFilter(config));
```

### Non-standard error response shape

```typescript
// BAD — ad-hoc shape, clients cannot rely on consistent structure
response.status(400).json({ message: error.message, code: 'INVALID' });

// GOOD — ProblemDetails (RFC 9457) — consistent, standards-compliant
response.status(400).json({
  type: 'https://httpstatuses.io/400',
  title: 'Bad Request',
  status: 400,
  detail: error.message,
  instance: request.url,
});
```

### Logging PII in error filter

```typescript
// BAD — logs email address in error context
this.logger.error(`Validation failed for user ${request.body.email}`);

// GOOD — log the route and status only
this.logger.error(`${request.method} ${request.url} → 400`);
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Handle all unhandled exceptions | `AllExceptionsFilter` via `app.useGlobalFilters()` |
| Map TypeORM `EntityNotFoundError` to 404 | `@Catch(EntityNotFoundError)` filter |
| Consistent HTTP error shape | ProblemDetails (RFC 9457) in all filters |
| Suppress stack traces in production | Check `NODE_ENV === 'production'` in filter |
| Log 5xx errors | Logger in `AllExceptionsFilter` for `status >= 500` |
| Validation errors (422/400) | `ValidationPipe` auto-formats; filter logs them |
| Domain result errors (not thrown) | Use discriminated union result type in service |
