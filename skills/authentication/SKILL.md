---
name: authentication
description: >
  Authentication and authorization for NestJS using Passport.js, JWT bearer tokens,
  JwtAuthGuard, RolesGuard, and the @Public() bypass decorator.
  Covers JWT strategy, refresh token rotation, and policy-based access.
  Load this skill when implementing login, JWT auth, guards, role-based access,
  or when the user mentions "authentication", "authorization", "JWT", "passport",
  "JwtAuthGuard", "RolesGuard", "login", "refresh token", "bearer token",
  "guard", "@UseGuards", "RBAC", or "access control".
---

# Authentication (NestJS)

## Core Principles

1. **Passport strategies are the standard** — `@nestjs/passport` wraps Passport.js
   cleanly. Use `JwtStrategy` for stateless APIs, `LocalStrategy` for login endpoints.
2. **Guards enforce auth, not middleware** — Use `JwtAuthGuard` on routes (or globally
   via `APP_GUARD`). Middleware runs before guards and cannot stop requests cleanly.
3. **Global guard + @Public() is cleaner than per-route @UseGuards** — Register
   `JwtAuthGuard` globally via `APP_GUARD`; every new route is protected by default.
4. **Never store passwords in plain text** — Use `bcrypt` with cost factor 12+.
5. **Refresh tokens in HttpOnly cookies** — Access tokens in Authorization headers;
   refresh tokens in HttpOnly, Secure, SameSite=Strict cookies.

## Patterns

### JWT Strategy and Guard

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email, roles: payload.roles };
  }
}

// auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// auth/decorators/public.decorator.ts
export const Public = () => SetMetadata('isPublic', true);
```

### Roles Guard

```typescript
// auth/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest();
    return roles.some((r) => user?.roles?.includes(r));
  }
}

// auth/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

### AuthModule Registration

```typescript
// auth/auth.module.ts
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
```

### Global Guard Registration

```typescript
// app.module.ts providers array
import { APP_GUARD } from '@nestjs/core';

providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

### Login with LocalStrategy

```typescript
// auth/strategies/local.strategy.ts
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}

// auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  login(user: User): { accessToken: string } {
    const payload: JwtPayload = { sub: user.id, email: user.email, roles: user.roles };
    return { accessToken: this.jwtService.sign(payload) };
  }
}

// auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Request() req: { user: User }) {
    return this.authService.login(req.user);
  }
}
```

### CurrentUser Decorator

```typescript
// auth/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

// Usage
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  return user;
}
```

## Anti-patterns

### Don't Do Auth Logic in Controllers

```typescript
// BAD — authorization leaks into controller
@Get(':id')
async findOrder(@Param('id') id: string, @Request() req) {
  if (!req.user.roles.includes('admin')) throw new ForbiddenException();
  return this.service.findById(id);
}

// GOOD — guard handles it declaratively
@Roles('admin')
@Get(':id')
findOrder(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}
```

### Don't Hardcode JWT Secret

```typescript
// BAD
JwtModule.register({ secret: 'hardcoded-secret' })

// GOOD
JwtModule.registerAsync({
  useFactory: (config: ConfigService) => ({ secret: config.getOrThrow('JWT_SECRET') }),
  inject: [ConfigService],
})
```

### Don't Use Long-Lived Access Tokens

```typescript
// BAD — 7-day token cannot be revoked without a blocklist
signOptions: { expiresIn: '7d' }

// GOOD — short access token + refresh token rotation
signOptions: { expiresIn: '15m' }
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Stateless REST API auth | JWT via `passport-jwt` |
| Login endpoint | `LocalStrategy` + `AuthGuard('local')` |
| Protect all routes by default | `APP_GUARD` + `JwtAuthGuard` |
| Public routes | `@Public()` decorator |
| Role-based access | `RolesGuard` + `@Roles()` decorator |
| Fine-grained permissions | Custom `CanActivate` with `Reflector` |
| API key auth | Custom guard reading `x-api-key` header |
| Social login | `passport-google-oauth20`, `passport-github2` |
