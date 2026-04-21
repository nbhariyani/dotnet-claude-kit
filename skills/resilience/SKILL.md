---
name: resilience
description: >
  Resilience patterns for NestJS: retry, circuit breaker, timeout, bulkhead.
  Load this skill when working with cockatiel, transient failure handling,
  HTTP retry, circuit breaker, timeout interceptors, or external service calls.
---

## Core Principles

1. **Retry without circuit breaker is dangerous.** Retrying against a failing
   dependency increases load on an already-struggling service. Always wrap retries
   inside a circuit breaker that opens after consecutive failures.

2. **Timeouts are mandatory for all external I/O.** Without a timeout, a slow
   downstream service can exhaust the NestJS event loop queue and take down your
   entire API. Set timeouts at the HTTP client level and at the interceptor level.

3. **Exponential backoff reduces thundering herd.** Linear or fixed-interval retries
   from multiple instances hammer a recovering service simultaneously. Use exponential
   backoff with jitter.

4. **Policies belong in shared providers.** Define `Policy.wrap(...)` once as an
   injectable provider; inject it into services that need it. Avoid duplicating
   policy configuration across services.

5. **Let cockatiel throw on open circuit.** Do not swallow `BrokenCircuitError`.
   Let it propagate and convert it to a `ServiceUnavailableException` at the
   controller or filter layer so clients receive the correct HTTP 503.

## Patterns

### Cockatiel: Retry + Circuit Breaker Policy

```typescript
// src/common/resilience/resilience.module.ts
import { Module } from '@nestjs/common';
import { RESILIENCE_POLICY } from './resilience.tokens';
import {
  Policy,
  ExponentialBackoff,
  ConsecutiveBreaker,
  handleAll,
  retry,
  circuitBreaker,
  wrap,
} from 'cockatiel';

const retryPolicy = retry(handleAll(), {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5000 }),
});

const circuitBreakerPolicy = circuitBreaker(handleAll(), {
  halfOpenAfter: 10_000,
  breaker: new ConsecutiveBreaker(5),
});

const wrappedPolicy = wrap(retryPolicy, circuitBreakerPolicy);

@Module({
  providers: [
    {
      provide: RESILIENCE_POLICY,
      useValue: wrappedPolicy,
    },
  ],
  exports: [RESILIENCE_POLICY],
})
export class ResilienceModule {}

// src/common/resilience/resilience.tokens.ts
export const RESILIENCE_POLICY = Symbol('RESILIENCE_POLICY');
```

### Using the Policy in a Service

```typescript
// src/payments/payments.service.ts
import { Injectable, Inject, ServiceUnavailableException } from '@nestjs/common';
import { IPolicy, BrokenCircuitError } from 'cockatiel';
import { RESILIENCE_POLICY } from '../common/resilience/resilience.tokens';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly http: HttpService,
    @Inject(RESILIENCE_POLICY) private readonly policy: IPolicy,
  ) {}

  async charge(amount: number, token: string): Promise<ChargeResult> {
    try {
      return await this.policy.execute(async () => {
        const response = await firstValueFrom(
          this.http.post<ChargeResult>('/charge', { amount, token }),
        );
        return response.data;
      });
    } catch (err) {
      if (err instanceof BrokenCircuitError) {
        throw new ServiceUnavailableException('Payment service unavailable');
      }
      throw err;
    }
  }
}
```

### Timeout Interceptor with RxJS

```typescript
// src/common/interceptors/timeout.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 5000) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}

// Register globally in main.ts
app.useGlobalInterceptors(new TimeoutInterceptor(5000));
```

### HttpModule with Default Timeout

```typescript
// src/payments/payments.module.ts
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow('PAYMENTS_API_URL'),
        timeout: 3000,
        maxRedirects: 0,
        headers: {
          'Authorization': `Bearer ${config.getOrThrow('PAYMENTS_API_KEY')}`,
        },
      }),
    }),
    ResilienceModule,
  ],
  providers: [PaymentsService],
})
export class PaymentsModule {}
```

## Anti-patterns

### Retry Without Circuit Breaker

```typescript
// BAD — retrying 3x against a down service triples the load
const retryOnly = retry(handleAll(), { maxAttempts: 3 });

// GOOD — wrap retry inside circuit breaker
const safe = wrap(
  retry(handleAll(), { maxAttempts: 3, backoff: new ExponentialBackoff() }),
  circuitBreaker(handleAll(), { halfOpenAfter: 10_000, breaker: new ConsecutiveBreaker(5) }),
);
```

### No Timeout on External HTTP

```typescript
// BAD — hangs indefinitely if the downstream service is slow
const response = await firstValueFrom(this.http.get('/slow-endpoint'));

// GOOD — explicit timeout via HttpModule config + TimeoutInterceptor
// HttpModule configured with timeout: 3000 (see above)
```

### Swallowing BrokenCircuitError

```typescript
// BAD — client receives generic 500 instead of 503; no signal to back off
try {
  return await this.policy.execute(() => this.callExternalService());
} catch {
  return null;
}

// GOOD — map to correct HTTP status
} catch (err) {
  if (err instanceof BrokenCircuitError) {
    throw new ServiceUnavailableException('Dependency unavailable');
  }
  throw err;
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| External HTTP API calls | cockatiel wrap(retry, circuitBreaker) + HttpModule timeout |
| All routes need a timeout | Global `TimeoutInterceptor` in main.ts |
| Per-route timeout override | `@UseInterceptors(new TimeoutInterceptor(2000))` |
| Queue-based work | Let BullMQ handle retries; use `attempts` + exponential backoff config |
| DB connection transient errors | TypeORM connection pool handles reconnect; no manual retry needed |
| Circuit open — 503 response | Catch `BrokenCircuitError` → `ServiceUnavailableException` |
