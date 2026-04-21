---
name: pino-logging
description: >
  Structured logging for NestJS with nestjs-pino: setup, per-class Logger injection,
  correlation IDs, request logging, log levels, and PII safety. Load when setting up
  logging, adding request tracing, or replacing console.log.
  Trigger keywords: logging, pino, nestjs-pino, Logger, structured logs, JSON logs,
  correlation ID, request logging, log level, PII, console.log.
---

## Core Principles

1. **No `console.log` anywhere in the codebase.** Inject `Logger` from `@nestjs/common`
   in every class. Rationale: `console.log` is unstructured, has no log level, and
   does not integrate with log aggregators.

2. **nestjs-pino for production logging.** It replaces NestJS's built-in logger with
   pino — the fastest Node.js JSON logger — while keeping the same `Logger` API.
   Rationale: structured JSON logs are queryable in Datadog, CloudWatch, Loki. Plain
   text logs are not.

3. **Never log PII at `info` level or above.** Emails, IP addresses, names, tokens,
   and payment data must not appear in production logs. Rationale: log aggregators are
   broadly accessible; PII in logs is a compliance liability (GDPR, CCPA).

4. **Correlation IDs via `pino-http` `genReqId`.** Every log line within a request
   must share the same `requestId`. Rationale: without correlation IDs, debugging a
   multi-step request in aggregated logs is infeasible.

5. **Log level from environment.** `debug` in development, `info` in staging/production.
   Rationale: debug logs in production produce gigabytes of noise and incur ingestion
   costs.

## Patterns

### Install

```bash
pnpm add nestjs-pino pino-http
pnpm add -D pino-pretty  # dev pretty printing only
```

### AppModule setup with LoggerModule.forRootAsync

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get('NODE_ENV') !== 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL') ?? (isDevelopment ? 'debug' : 'info'),
            transport: isDevelopment
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
            genReqId: req => req.headers['x-request-id'] ?? crypto.randomUUID(),
            redact: ['req.headers.authorization', 'req.body.password'], // redact sensitive fields
            serializers: {
              req: req => ({ method: req.method, url: req.url, id: req.id }),
              res: res => ({ statusCode: res.statusCode }),
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### main.ts — use pino logger for bootstrap

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  await app.listen(3000);
}

bootstrap();
```

### Per-class Logger injection

```typescript
// orders/orders.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  async findById(id: string): Promise<Order> {
    this.logger.debug(`Looking up order ${id}`);

    const order = await this.ordersRepo.findById(id);
    if (!order) {
      this.logger.warn(`Order not found: ${id}`);
      throw new NotFoundException(`Order ${id} not found`);
    }

    this.logger.log(`Order retrieved: ${id}`); // 'log' = info level
    return order;
  }

  async processPayment(orderId: string, amount: number): Promise<void> {
    try {
      await this.gateway.charge(amount);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // GOOD: log amount and orderId, NOT customer email or card number
      this.logger.error(`Payment failed for order ${orderId}: ${message}`);
      throw error;
    }
  }
}
```

### Log level semantics

```typescript
this.logger.verbose('Raw SQL query params');     // verbose — very detailed, dev only
this.logger.debug('Cache miss for key user:123'); // debug — internal state
this.logger.log('Order created: ord-456');        // log = info — business events
this.logger.warn('Retry attempt 2/3 for payment'); // warn — recoverable issue
this.logger.error('Database connection lost', stack); // error — action required
```

### Correlation ID propagation in service

```typescript
// In a service called from an HTTP handler, pino-http automatically
// propagates the request context. All logger calls within the request
// chain will include the same requestId in their log output.

// To read the request ID in a service (if needed):
import { REQUEST } from '@nestjs/core';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getRequestId(): string {
    return (this.request as Request & { id: string }).id;
  }
}
```

### Environment-based log config

```typescript
// config/logger.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('logger', () => ({
  level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  prettyPrint: process.env['NODE_ENV'] === 'development',
}));
```

## Anti-patterns

### console.log in service code

```typescript
// BAD — unstructured, no level, no correlation ID
console.log('Creating order for customer', customerId);
console.error('Failed:', err);

// GOOD
this.logger.log(`Creating order for customer ${customerId}`);
this.logger.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
```

### Logging PII at info level

```typescript
// BAD — email, IP, and token will appear in production log aggregators
this.logger.log(`User logged in: ${user.email} from ${request.ip}`);
this.logger.log(`Token issued: ${jwt}`);

// GOOD — log only non-sensitive identifiers
this.logger.log(`User authenticated: ${user.id}`);
```

### No correlation IDs

```typescript
// BAD — impossible to trace a single request across multiple log lines
[INFO] Processing order
[INFO] Charging payment
[INFO] Order created
// Which request? Which user?

// GOOD — pino-http adds requestId automatically
// {"level":"info","requestId":"a1b2c3","msg":"Processing order"}
// {"level":"info","requestId":"a1b2c3","msg":"Charging payment"}
```

### Custom Logger class instead of nestjs-pino

```typescript
// BAD — reinventing the wheel, loses pino's performance and JSON output
@Injectable()
export class AppLogger {
  log(message: string) { console.log(`[${new Date().toISOString()}] ${message}`); }
}

// GOOD — nestjs-pino integrates with NestJS Logger API and adds JSON + correlation
import { Logger } from 'nestjs-pino';
app.useLogger(app.get(Logger));
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Replace NestJS default logger | `nestjs-pino` + `app.useLogger(app.get(Logger))` |
| Per-class logging | `private readonly logger = new Logger(ClassName.name)` |
| Request/response logging | `pino-http` via `LoggerModule.forRootAsync` |
| Correlation ID per request | `genReqId` in `pinoHttp` config |
| Pretty output in development | `pino-pretty` transport in dev only |
| Redact authorization headers | `redact: ['req.headers.authorization']` in pinoHttp |
| Adjust log level at runtime | `LOG_LEVEL` env var + `ConfigService` |
