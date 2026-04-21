---
name: api-versioning
description: >
  NestJS API versioning strategies. Load this skill when setting up API versioning,
  working with @Version decorator, enableVersioning, URI versioning, header versioning,
  or managing breaking API changes between v1 and v2.
---

## Core Principles

1. **URI versioning is the most visible and cache-friendly.** `/api/v1/orders` is
   self-documenting, works with every HTTP client, and is easy to route in a gateway.
   Use URI versioning as the default unless a specific client constraint demands
   otherwise.

2. **Set a `defaultVersion` so unversioned routes still work.** Without a
   `defaultVersion`, requests to `/api/orders` return 404. Setting `defaultVersion: '1'`
   provides a sensible fallback and eases migration.

3. **Use `VERSION_NEUTRAL` for infrastructure endpoints.** Health checks, metrics,
   and root metadata endpoints do not belong to any version. `VERSION_NEUTRAL` keeps
   them accessible at `/api/health` regardless of versioning config.

4. **Never delete an old version without a deprecation period.** Clients break silently
   when an API version disappears. Mark old versions as deprecated (via a response
   header or documentation note) and provide a migration timeline before removal.

5. **Version at the controller level; override at the handler level when needed.**
   A controller-level `@Controller({ version: '1' })` covers all its handlers. Use
   `@Version('2')` on a single handler to add a new behavior without duplicating the
   entire controller.

## Patterns

### Enable URI Versioning in main.ts

```typescript
// src/main.ts
import { VersioningType } from '@nestjs/common';

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api');
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
await app.listen(config.getOrThrow('PORT'));
```

Routes produced:
- `GET /api/v1/orders` — versioned
- `GET /api/orders` — resolves to v1 via defaultVersion

### Controller-Level Versioning

```typescript
// src/orders/orders.controller.ts
import { Controller, Get, Version } from '@nestjs/common';

@Controller({ version: '1', path: 'orders' })
export class OrdersV1Controller {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }
}
```

### Per-Handler Version Override

```typescript
// Single controller serves both v1 and v2 of different handlers
@Controller({ version: '1', path: 'orders' })
export class OrdersController {
  @Get()
  findAll() {
    // v1 response shape
    return this.ordersService.findAll();
  }

  // Override to v2 for a single endpoint
  @Get(':id')
  @Version('2')
  findOneV2(@Param('id', ParseUUIDPipe) id: string) {
    // v2 response with additional fields
    return this.ordersService.findByIdWithDetails(id);
  }
}
```

### VERSION_NEUTRAL for Infrastructure Routes

```typescript
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller({ version: VERSION_NEUTRAL, path: 'health' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
// Route: GET /api/health  (no version prefix)
```

### Header Versioning (Alternative)

```typescript
// main.ts — use Accept-Version header instead of URI segment
app.enableVersioning({
  type: VersioningType.HEADER,
  header: 'Accept-Version',
});
// Client sends: Accept-Version: 2
```

### Deprecation Response Header

```typescript
// Interceptor to signal deprecated API version
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = ctx.switchToHttp().getResponse<Response>();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Sat, 01 Jan 2026 00:00:00 GMT');
    return next.handle();
  }
}

// Apply to deprecated v1 controller
@UseInterceptors(DeprecationInterceptor)
@Controller({ version: '1', path: 'orders' })
export class OrdersV1Controller { ... }
```

## Anti-patterns

### Manual Versioning in Route String

```typescript
// BAD — hardcoded prefix in path; NestJS versioning features don't apply
@Controller('v1/orders')
export class OrdersController { ... }

// GOOD — NestJS handles the prefix
@Controller({ version: '1', path: 'orders' })
export class OrdersController { ... }
```

### No defaultVersion (Unversioned 404)

```typescript
// BAD — /api/orders returns 404 because there is no defaultVersion
app.enableVersioning({ type: VersioningType.URI });

// GOOD
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

### Deleting Old Versions Without Deprecation Period

```typescript
// BAD — v1 removed; existing clients receive 404 with no warning

// GOOD — deprecate first, set a Sunset date, then remove after the deadline
@UseInterceptors(DeprecationInterceptor)
@Controller({ version: '1', path: 'orders' })
export class OrdersV1Controller { /* still functional */ }
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Default versioning strategy | URI versioning with `defaultVersion: '1'` |
| Clients use browser/simple curl | URI versioning (`/v1/`, `/v2/`) |
| API gateway controls version routing | Header versioning |
| Health / metrics / root | `VERSION_NEUTRAL` |
| Breaking change in one endpoint only | `@Version('2')` on that handler, keep v1 |
| Full resource redesign | New `OrdersV2Controller` with `version: '2'` |
| Retiring an old version | Add `DeprecationInterceptor`, announce Sunset date |
