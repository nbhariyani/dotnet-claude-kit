---
name: security-scan
description: >
  Security hardening and scanning for NestJS applications. Load this skill when
  doing security audits, running npm audit, configuring helmet, rate limiting with
  @nestjs/throttler, validating JWT secrets, securing CORS, or setting up
  eslint-plugin-security.
---

## Core Principles

1. **`helmet()` must be called before any route registration.** Helmet sets response
   headers (`CSP`, `HSTS`, `X-Frame-Options`). Calling it after `app.listen()` or
   after routes are registered means some requests will never receive the headers.

2. **Rate limiting is global by default.** Applying `ThrottlerGuard` as an `APP_GUARD`
   means every route is rate-limited unless explicitly opted out. Opt-in rate limiting
   leaves endpoints vulnerable by default.

3. **JWT secrets must come from `ConfigService.getOrThrow()`.** Hardcoded secrets
   end up in git history. Weak secrets can be brute-forced. Validate minimum length
   (32 chars) in the Joi schema.

4. **CORS explicit origin list from config.** `origin: '*'` exposes your API to
   every domain. In production, only allow known origins via an environment variable.

5. **`npm audit` in CI at `moderate` severity or higher.** Auditing only at the
   command line before releases is too slow. Critical and high vulnerabilities should
   block the CI pipeline.

## Patterns

### Complete Security Setup in main.ts

```typescript
// src/main.ts
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 1. Helmet FIRST — before all routes and middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // 2. CORS with explicit origin list
  app.enableCors({
    origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // 3. Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // ThrottlerGuard applied via APP_GUARD in AppModule (see below)

  await app.listen(config.getOrThrow<number>('PORT'));
}
```

### ThrottlerModule Global Rate Limiting

```typescript
// src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: 10,   // 10 req/sec per IP
          },
          {
            name: 'long',
            ttl: 60_000,
            limit: 300,  // 300 req/min per IP
          },
        ],
        storage: new ThrottlerStorageRedisService(
          config.getOrThrow('REDIS_HOST'),
          config.getOrThrow<number>('REDIS_PORT'),
        ),
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,  // applies to every route globally
    },
  ],
})
export class AppModule {}

// Skip rate limiting on a specific route (e.g., health check)
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller({ version: VERSION_NEUTRAL, path: 'health' })
export class HealthController { ... }
```

### JwtModule with ConfigService

```typescript
// src/auth/auth.module.ts
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN'),
          issuer: config.getOrThrow<string>('APP_NAME'),
        },
      }),
    }),
  ],
})
export class AuthModule {}
```

### Joi Validation Schema for Security-Critical Vars

```typescript
// In ConfigModule.forRoot validationSchema
validationSchema: Joi.object({
  JWT_SECRET: Joi.string().min(32).required()
    .messages({ 'string.min': 'JWT_SECRET must be at least 32 characters' }),
  ALLOWED_ORIGINS: Joi.string().required(),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  DATABASE_URL: Joi.string().uri().required(),
})
```

### npm audit in CI

```yaml
# .github/workflows/ci.yml
- name: Security audit
  run: npm audit --audit-level=moderate
  # Fails the build if moderate or higher vulnerabilities are found
```

### eslint-plugin-security Setup

```bash
pnpm add -D eslint-plugin-security
```

```javascript
// eslint.config.js
const security = require('eslint-plugin-security');

module.exports = [
  security.configs.recommended,
  {
    rules: {
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-possible-timing-attacks': 'error',
    },
  },
];
```

## Anti-patterns

### Hardcoded JWT Secret

```typescript
// BAD — visible in source control; no rotation possible
JwtModule.register({ secret: 'my-super-secret-key' })

// GOOD — from ConfigService, validated at startup
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
  }),
})
```

### Wildcard CORS in Production

```typescript
// BAD — any domain can make authenticated requests to your API
app.enableCors({ origin: '*' });

// GOOD — explicit allowlist from config
app.enableCors({
  origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(','),
});
```

### helmet() After app.listen()

```typescript
// BAD — some responses have already been sent without security headers
await app.listen(3000);
app.use(helmet());  // too late

// GOOD — helmet before everything
app.use(helmet());
app.use(otherMiddleware);
await app.listen(3000);
```

### No Rate Limiting

```typescript
// BAD — brute force and DDoS attacks are unrestricted
@Module({ imports: [OrdersModule, UsersModule] })
export class AppModule {}

// GOOD — ThrottlerModule + APP_GUARD covers all routes by default
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| First-time security setup | Apply all 5 patterns in this skill |
| JWT secret rotation | Use configurable secret with `configService.getOrThrow` + redeploy |
| Public endpoint (health check) | `@SkipThrottle()` + `@Public()` |
| API behind a trusted proxy | `app.set('trust proxy', 1)` before `enableCors` |
| Vulnerability in dependency | `npm audit fix` or pin to safe version in package.json |
| SQL injection prevention | Use parameterized queries (TypeORM/Prisma handle this by default) |
| Sensitive data in logs | Never log PII; audit log calls for token/password/email |
