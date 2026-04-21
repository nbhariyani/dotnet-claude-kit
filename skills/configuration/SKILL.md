---
name: configuration
description: >
  NestJS configuration management with @nestjs/config, ConfigService, and Joi.
  Load this skill when working with environment variables, .env files, ConfigModule,
  registerAs typed sub-config, startup validation, or replacing process.env access.
---

## Core Principles

1. **Validate the environment at startup.** A Joi `validationSchema` in
   `ConfigModule.forRoot` causes the application to throw with a clear message if
   required variables are missing or have wrong types. Silent undefined values at
   runtime are harder to debug.

2. **`ConfigService.getOrThrow()` over `.get()` for required values.** `.get()` can
   return `undefined` if the key is missing. `.getOrThrow()` throws immediately with
   the key name, making the failure explicit.

3. **`registerAs` for typed, namespaced sub-configs.** Group related variables under
   a namespace (`database`, `jwt`, `redis`). Consuming code injects a typed sub-config
   rather than calling `config.get('DATABASE_URL')` with magic strings scattered
   everywhere.

4. **`process.env` only inside `registerAs` factories.** The config factory is the
   single allowed place to access `process.env`. All other code uses `ConfigService`.

5. **Commit `.env.example`, never `.env`.** `.env` holds real secrets. `.env.example`
   is the contract — it documents what variables are required without exposing values.

## Patterns

### ConfigModule.forRoot with Joi Validation

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env['NODE_ENV']}`, '.env'],
      load: [databaseConfig, jwtConfig, redisConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().integer().min(1).max(65535).default(3000),
        APP_NAME: Joi.string().required(),
        DATABASE_URL: Joi.string().uri().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        REDIS_HOST: Joi.string().hostname().required(),
        REDIS_PORT: Joi.number().integer().default(6379),
        ALLOWED_ORIGINS: Joi.string().required(),
      }),
      validationOptions: { abortEarly: true },
    }),
  ],
})
export class AppModule {}
```

### Typed Sub-Config with registerAs

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
  logging: boolean;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env['DATABASE_URL'] as string,
  poolSize: parseInt(process.env['DB_POOL_SIZE'] ?? '10', 10),
  ssl: process.env['NODE_ENV'] === 'production',
  logging: process.env['NODE_ENV'] === 'development',
}));

// src/config/jwt.config.ts
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env['JWT_SECRET'] as string,
  expiresIn: process.env['JWT_EXPIRES_IN'] ?? '1h',
}));
```

### ConfigService Usage in a Module

```typescript
// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return {
          type: 'postgres',
          url: db.url,
          extra: { max: db.poolSize },
          ssl: db.ssl ? { rejectUnauthorized: true } : false,
          logging: db.logging,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/../migrations/*{.ts,.js}'],
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
```

### ConfigService Usage in a Service

```typescript
// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  generateToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn: this.config.getOrThrow<string>('jwt.expiresIn'),
      },
    );
  }
}
```

### .env.example

```bash
NODE_ENV=development
PORT=3000
APP_NAME=my-nestjs-api
DATABASE_URL=postgres://user:password@localhost:5432/mydb
DB_POOL_SIZE=10
JWT_SECRET=replace-with-min-32-character-random-string
JWT_EXPIRES_IN=1h
REDIS_HOST=localhost
REDIS_PORT=6379
ALLOWED_ORIGINS=http://localhost:4200
```

## Anti-patterns

### process.env in Services

```typescript
// BAD — bypasses validation, untestable, no type safety
@Injectable()
export class MailService {
  private readonly apiKey = process.env.MAIL_API_KEY;
}

// GOOD — injected, validated at startup
@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}
  private get apiKey(): string {
    return this.config.getOrThrow<string>('MAIL_API_KEY');
  }
}
```

### config.get() Without Fallback on Required Values

```typescript
// BAD — returns undefined if key missing; error surfaces much later
const secret = this.config.get('JWT_SECRET');
const token = jwt.sign(payload, secret); // TypeError: secret is undefined

// GOOD — throws immediately with clear message
const secret = this.config.getOrThrow<string>('JWT_SECRET');
```

### No Startup Validation

```typescript
// BAD — app starts even with missing DATABASE_URL; crashes on first DB call
ConfigModule.forRoot({ isGlobal: true })

// GOOD — Joi schema rejects startup if required vars are missing
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({ DATABASE_URL: Joi.string().required() }),
})
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Required string variable | `Joi.string().required()` + `config.getOrThrow()` |
| Optional with default | `Joi.number().default(3000)` + `config.get('PORT', 3000)` |
| Grouping related vars (DB, JWT) | `registerAs('namespace', factory)` |
| Feature flag | `Joi.boolean().default(false)` |
| Env-specific .env files | `envFilePath: ['.env.${NODE_ENV}', '.env']` |
| Testing with different config | Provide mock `ConfigService` in `createTestingModule` |
