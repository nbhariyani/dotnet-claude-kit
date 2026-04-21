---
name: health-check
description: >
  NestJS health check endpoints with @nestjs/terminus. Load this skill when
  adding /health endpoints, configuring liveness or readiness probes, using
  TypeOrmHealthIndicator, writing custom health indicators, or configuring
  Kubernetes probes.
---

## Core Principles

1. **Separate liveness from readiness.** Liveness (`/health`) answers "is the
   process alive?" — it should never check external dependencies. Readiness
   (`/health/ready`) answers "can this instance serve traffic?" — it checks DB,
   Redis, and other dependencies. Conflating them causes Kubernetes to restart
   pods on DB outages instead of just routing traffic away.

2. **Never require auth on health endpoints.** Infrastructure (load balancers,
   Kubernetes probes) cannot authenticate. Mark health controllers with `@Public()`.

3. **Always return HTTP 503 when unhealthy.** `@nestjs/terminus` does this
   automatically for failing checks. Never catch the HealthCheckError and return 200.

4. **Liveness must be cheap.** A liveness check that queries the database can fail
   when the database is down, causing unnecessary pod restarts. Keep liveness at
   process-level only.

5. **Custom indicators extend `HealthIndicator`.** Wrap external checks in a
   `HealthIndicator` subclass so they integrate cleanly with terminus's reporting
   and HTTP status code handling.

## Patterns

### HealthModule Setup

```typescript
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [
    TerminusModule,
    HttpModule,  // required for HttpHealthIndicator
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
```

### HealthController: Liveness + Readiness

```typescript
// src/health/health.controller.ts
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Public()
@Controller({ version: VERSION_NEUTRAL, path: 'health' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // Liveness: only process-level checks (never DB)
  @Get()
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  // Readiness: check all dependencies
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

### Custom Redis Health Indicator

```typescript
// src/health/indicators/redis.health-indicator.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await this.redis.ping();
      const isHealthy = result === 'PONG';
      const details = this.getStatus(key, isHealthy);

      if (isHealthy) return details;
      throw new HealthCheckError('Redis ping failed', details);
    } catch (err) {
      const details = this.getStatus(key, false, { message: (err as Error).message });
      throw new HealthCheckError('Redis check failed', details);
    }
  }
}
```

### Kubernetes Probe Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
            timeoutSeconds: 3
```

### Registering HealthModule in AppModule

```typescript
// src/app.module.ts
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,      // no version prefix needed; controller uses VERSION_NEUTRAL
    OrdersModule,
  ],
})
export class AppModule {}
```

## Anti-patterns

### DB Check in Liveness Probe

```typescript
// BAD — database outage causes liveness to fail → Kubernetes restarts all pods
@Get()
@HealthCheck()
liveness() {
  return this.health.check([
    () => this.db.pingCheck('database'),  // don't put this in liveness
  ]);
}

// GOOD — DB check only in readiness; liveness is process-only
@Get()
@HealthCheck()
liveness() {
  return this.health.check([
    () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
  ]);
}
```

### Health Endpoint Requires Authentication

```typescript
// BAD — Kubernetes probe receives 401; probe fails; pod is marked unhealthy
@Controller('health')
export class HealthController { ... }  // protected by global JWT guard

// GOOD — explicitly mark as public
@Public()
@Controller({ version: VERSION_NEUTRAL, path: 'health' })
export class HealthController { ... }
```

### Always Returning 200

```typescript
// BAD — hides real failures; load balancer keeps routing to broken instance
@Get('ready')
async readiness() {
  try {
    await this.health.check([() => this.db.pingCheck('database')]);
    return { status: 'ok' };
  } catch {
    return { status: 'error' };  // still returns HTTP 200
  }
}

// GOOD — let terminus throw HealthCheckError; it maps to HTTP 503 automatically
@Get('ready')
@HealthCheck()
readiness() {
  return this.health.check([
    () => this.db.pingCheck('database'),
  ]);
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Kubernetes liveness probe | `GET /health` — memory check only, no DB |
| Kubernetes readiness probe | `GET /health/ready` — DB + Redis + external deps |
| Auth on health routes | Never; use `@Public()` |
| Custom dependency check | Extend `HealthIndicator`, throw `HealthCheckError` |
| Timeout on DB ping | `db.pingCheck('database', { timeout: 1000 })` |
| Health check in load balancer | Same `/health` endpoint; returns 200 or 503 |
