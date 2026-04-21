---
name: interceptors
description: >
  NestJS Interceptors: NestInterceptor, CallHandler, Observable, LoggingInterceptor,
  TransformInterceptor, TimeoutInterceptor. Load when adding cross-cutting behavior
  around request/response: logging, response shaping, timeouts, or caching.
  Trigger keywords: interceptor, NestInterceptor, CallHandler, Observable, logging,
  response transform, timeout, cache, before and after handler.
---

## Core Principles

1. **Interceptors wrap the handler — they execute before AND after.** Code before
   `next.handle()` runs pre-handler; RxJS operators on the returned `Observable` run
   post-handler. Rationale: this is the only NestJS construct with access to both the
   inbound request and outbound response in a single place.

2. **Use interceptors for cross-cutting: logging, response shape, timeout, caching.**
   Not for auth (guards), not for validation (pipes), not for error formatting
   (filters). Rationale: each construct has a specific place in the pipeline; mixing
   concerns produces untestable code.

3. **`APP_INTERCEPTOR` for global interceptors, `@UseInterceptors()` for targeted.**
   Rationale: consistent response shape and request logging should apply everywhere;
   route-specific behavior (e.g., cache a single endpoint) is targeted.

4. **Never modify the incoming request body in an interceptor.** Use pipes instead.
   Rationale: pipes run before guards; interceptors run after. Mutating the body in an
   interceptor means guards already saw the unmutated version.

5. **Always pass the `Observable` through — never subscribe manually.** Let NestJS
   manage the subscription lifecycle. Rationale: manual `.subscribe()` inside an
   interceptor breaks error handling and memory management.

## Patterns

### LoggingInterceptor

```typescript
// common/interceptors/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { method, url } = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`${method} ${url} — ${ms}ms`);
      }),
    );
  }
}
```

### TransformInterceptor — wrap all responses in `{ data: ... }`

```typescript
// common/interceptors/transform.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(map(data => ({ data })));
  }
}
```

### TimeoutInterceptor

```typescript
// common/interceptors/timeout.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
```

### Register interceptors globally in AppModule

```typescript
// app.module.ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
```

### Route-specific interceptor

```typescript
// Apply only to a specific controller or endpoint
@Controller('reports')
@UseInterceptors(TimeoutInterceptor) // long-running routes only
export class ReportsController {
  @Get('export')
  export() { return this.reportsService.export(); }
}
```

### Conditional response transform (skip for streams)

```typescript
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse<{ headersSent: boolean }>();
    return next.handle().pipe(
      map(data => {
        // Skip wrapping for streaming responses or null
        if (data === null || data === undefined) return data as T;
        return { data };
      }),
    );
  }
}
```

## Anti-patterns

### Business logic in an interceptor

```typescript
// BAD — interceptor applying a discount is untestable and hidden
intercept(context: ExecutionContext, next: CallHandler) {
  return next.handle().pipe(
    map(order => ({ ...order, price: order.price * 0.9 })) // ??? discount logic
  );
}

// GOOD — business logic belongs in the service
async applyDiscount(orderId: string): Promise<Order> {
  return this.ordersService.applyDiscount(orderId);
}
```

### Mutating request body in interceptor

```typescript
// BAD — guards already saw the unmutated body
intercept(context: ExecutionContext, next: CallHandler) {
  const req = context.switchToHttp().getRequest();
  req.body.userId = this.extractUserId(req); // too late, should be a pipe
  return next.handle();
}

// GOOD — use a pipe for input transformation
@UsePipes(new AddUserIdPipe())
@Post()
create(@Body() dto: CreateOrderDto) { ... }
```

### Manually subscribing inside interceptor

```typescript
// BAD — breaks NestJS error handling and lifecycle
intercept(context: ExecutionContext, next: CallHandler) {
  next.handle().subscribe(data => console.log(data)); // leaks subscription
  return next.handle();
}

// GOOD — use RxJS operators, return the observable
intercept(context: ExecutionContext, next: CallHandler) {
  return next.handle().pipe(tap(data => console.log(data)));
}
```

### Using interceptor for authentication

```typescript
// BAD — runs after guards, wrong lifecycle position
intercept(context: ExecutionContext, next: CallHandler) {
  const token = context.switchToHttp().getRequest().headers.authorization;
  if (!token) throw new UnauthorizedException(); // use a guard instead
  ...
}

// GOOD — JwtAuthGuard via APP_GUARD runs before any handler
```

## Decision Guide

| Need | Tool |
|---|---|
| Log every request with timing | `LoggingInterceptor` via `APP_INTERCEPTOR` |
| Wrap all responses in `{ data: ... }` | `TransformInterceptor` via `APP_INTERCEPTOR` |
| Abort slow requests | `TimeoutInterceptor` on specific controllers |
| Validate and transform input | Pipe (`PipeTransform`) |
| Block unauthorized requests | Guard (`CanActivate`) |
| Format errors consistently | Exception filter (`ExceptionFilter`) |
| Cache a specific endpoint | `@UseInterceptors(CacheInterceptor)` on route |
