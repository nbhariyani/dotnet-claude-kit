---
name: guards
description: >
  NestJS Guards: JwtAuthGuard, RolesGuard, CanActivate, Reflector, APP_GUARD +
  @Public() pattern, and custom guards. Load when adding authentication,
  authorization, API key validation, or route protection.
  Trigger keywords: guard, auth guard, JWT, roles, @Public, CanActivate, Reflector,
  APP_GUARD, authentication, authorization, protect route.
---

## Core Principles

1. **`APP_GUARD` + `@Public()` over per-route `@UseGuards()`.** Register guards
   globally via `APP_GUARD` and mark public routes explicitly. Rationale: opt-out
   security means new routes are protected by default — forgotten `@UseGuards` on a
   new route is a silent vulnerability.

2. **Authentication guard runs before authorization guard.** Chain them in `APP_GUARD`
   order: `JwtAuthGuard` first, `RolesGuard` second. Rationale: checking roles on an
   unauthenticated request wastes computation and produces misleading errors.

3. **Guards return `false` to deny authorized users; throw `UnauthorizedException`
   for unauthenticated.** Rationale: `false` results in a 403 Forbidden (wrong role),
   `UnauthorizedException` produces 401 (not logged in). The distinction matters for
   clients.

4. **Business logic never in guards.** Guards answer one question: can this request
   proceed? No mutations, no side effects. Rationale: guards run before the handler;
   side effects here are unauditable and untestable in isolation.

5. **Use `Reflector` to read custom decorator metadata.** Never read metadata
   manually with `Reflect.getMetadata`. Rationale: `Reflector.getAllAndOverride` and
   `getAllAndMerge` handle inheritance and method-vs-class precedence correctly.

## Patterns

### @Public() decorator

```typescript
// common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### JwtAuthGuard with @Public() bypass

```typescript
// auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### @Roles() decorator

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export type Role = 'admin' | 'user' | 'moderator';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### RolesGuard with Reflector

```typescript
// auth/guards/roles.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: { roles: Role[] } }>();
    const hasRole = requiredRoles.some(role => user.roles.includes(role));
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

### APP_GUARD registration in AppModule

```typescript
// app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // runs first
    { provide: APP_GUARD, useClass: RolesGuard },   // runs second
  ],
})
export class AppModule {}
```

### Using @Public() and @Roles() on controllers

```typescript
@Controller('orders')
export class OrdersController {
  @Get()
  @Roles('admin', 'user')
  findAll() { ... }

  @Post()
  @Roles('user')
  create(@Body() dto: CreateOrderDto) { ... }
}

@Controller('auth')
export class AuthController {
  @Post('login')
  @Public() // explicitly bypasses JwtAuthGuard
  login(@Body() dto: LoginDto) { ... }

  @Post('register')
  @Public()
  register(@Body() dto: RegisterDto) { ... }
}
```

### Custom API key guard

```typescript
// common/guards/api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validKey: string;

  constructor(config: ConfigService) {
    this.validKey = config.getOrThrow<string>('API_KEY');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-api-key'];
    if (key !== this.validKey) throw new UnauthorizedException('Invalid API key');
    return true;
  }
}
```

## Anti-patterns

### Auth logic in controllers

```typescript
// BAD
@Get('admin')
async getAdminData(@Req() req: Request) {
  if (!req.user || req.user.role !== 'admin') {
    throw new ForbiddenException();
  }
  return this.service.getAdminData();
}

// GOOD — guard handles it, controller stays thin
@Get('admin')
@Roles('admin')
getAdminData() {
  return this.service.getAdminData();
}
```

### @UseGuards on every route instead of APP_GUARD

```typescript
// BAD — one missed @UseGuards = unprotected route
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile() { ... }

// GOOD — APP_GUARD protects all routes; @Public() opts out
@Get('profile')
getProfile() { ... }
```

### Throwing ForbiddenException for unauthenticated users

```typescript
// BAD — returns 403 when user is not logged in at all
if (!user) throw new ForbiddenException();

// GOOD — 401 for not authenticated, 403 for not authorized
if (!user) throw new UnauthorizedException();
if (!user.roles.includes('admin')) throw new ForbiddenException();
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Protect all routes by default | `APP_GUARD` + `JwtAuthGuard` |
| Mark a route as public | `@Public()` decorator |
| Role-based access control | `@Roles()` + `RolesGuard` via `APP_GUARD` |
| API key for internal services | Custom `CanActivate` guard |
| Webhook endpoint (no JWT) | `@Public()` + signature validation in guard |
| Guard specific controller only | `@UseGuards()` on the class (not recommended for auth) |
| Check permissions in guard | Read `request.user` set by passport strategy |
