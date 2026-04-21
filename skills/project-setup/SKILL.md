---
name: project-setup
description: >
  Bootstrap and initial configuration for a NestJS application. Load this skill
  when setting up main.ts, configuring tsconfig.json, initializing a new project,
  bootstrapping with helmet/cors/validation, or getting started with NestJS.
---

## Core Principles

1. **Complete main.ts from day one.** Register ValidationPipe, ExceptionFilter, Helmet,
   CORS, and Swagger in `main.ts` before the first endpoint is written. Retrofitting
   global middleware is risky and error-prone.

2. **`strict: true` and decorator metadata always on.** `experimentalDecorators` and
   `emitDecoratorMetadata` are required for NestJS DI and class-validator to function.
   Missing `emitDecoratorMetadata` causes silent DI failures.

3. **ConfigModule validates at startup.** Use Joi `validationSchema` so the app refuses
   to start with missing or invalid environment variables rather than failing at runtime.

4. **Never use `process.env` directly in services.** Inject `ConfigService` so config
   reads are testable, typed, and validated.

5. **Global prefix and versioning before Swagger setup.** Route configuration affects
   the generated spec; set it up in the correct order.

## Patterns

### Complete main.ts

```typescript
// src/main.ts
import './tracing';  // must be first if using OpenTelemetry
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(','),
    credentials: true,
  });

  // Global prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global pipes and filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger (non-production only, or gated by config)
  if (config.get('NODE_ENV') !== 'production') {
    const spec = new DocumentBuilder()
      .setTitle(config.getOrThrow('APP_NAME'))
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, spec);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}

bootstrap();
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### AppModule with ConfigModule and Joi Validation

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        APP_NAME: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        ALLOWED_ORIGINS: Joi.string().required(),
      }),
      validationOptions: { abortEarly: true },
    }),
    OrdersModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### Typed Config with registerAs

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env['DATABASE_URL'],        // only process.env usage is inside registerAs
  poolSize: parseInt(process.env['DB_POOL_SIZE'] ?? '10', 10),
  ssl: process.env['NODE_ENV'] === 'production',
}));

// Usage in a module
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow('database.url'),
        ssl: config.get('database.ssl'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
```

### .env.example

```bash
NODE_ENV=development
PORT=3000
APP_NAME=my-api
DATABASE_URL=postgres://user:password@localhost:5432/mydb
JWT_SECRET=change-me-to-a-32-char-minimum-secret
ALLOWED_ORIGINS=http://localhost:4200
```

## Anti-patterns

### Missing emitDecoratorMetadata

```json
// BAD — DI silently fails; injected services are undefined at runtime
{
  "compilerOptions": {
    "experimentalDecorators": true
    // emitDecoratorMetadata missing
  }
}

// GOOD
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### ValidationPipe Per-Controller

```typescript
// BAD — validation missing on any controller that forgets the decorator
@Controller('orders')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class OrdersController { ... }

// GOOD — registered once globally in main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

### process.env in Services

```typescript
// BAD — untestable, bypasses startup validation
@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET;
}

// GOOD — injected, validated, typed
@Injectable()
export class JwtService {
  constructor(private readonly config: ConfigService) {}
  private get secret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New NestJS project | `nest new` then apply full main.ts pattern above |
| Config validation missing | Add Joi schema to ConfigModule.forRoot |
| DI not injecting (undefined) | Check emitDecoratorMetadata in tsconfig.json |
| Swagger not showing routes | Ensure SwaggerModule.setup called after global prefix |
| CORS errors in production | Explicit origin array from ConfigService |
| Environment-specific behavior | NODE_ENV in Joi schema + config.get('NODE_ENV') |
