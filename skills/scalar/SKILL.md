---
name: scalar
description: >
  Scalar API reference UI for NestJS as a modern alternative to Swagger UI.
  Load this skill when setting up @scalar/nestjs-api-reference, replacing or
  augmenting Swagger UI, configuring a better API explorer, or exposing the
  OpenAPI spec for Scalar.
---

## Core Principles

1. **Keep `@nestjs/swagger` for spec generation; use Scalar only for the UI.**
   `@nestjs/swagger` generates the OpenAPI document (via `SwaggerModule.createDocument`).
   Scalar renders that document in a better UI. The two are complementary, not mutually
   exclusive.

2. **Expose the spec at `/api-json` so Scalar can reference it.** Scalar needs a URL
   to fetch the OpenAPI JSON. Use `SwaggerModule.setup` with a custom path just for
   the JSON endpoint, or write the spec as a static response.

3. **Never run both Swagger UI and Scalar on the same path.** They will conflict.
   Use different paths: `/docs` for Scalar, `/docs-swagger` for Swagger UI if you
   need both during migration.

4. **Gate the UI on non-production environments.** API explorers expose your full
   API surface to anyone who can reach the server. Never enable Scalar in production
   unless the endpoint is behind auth or an internal network.

5. **Scalar uses the same `@ApiProperty` annotations as Swagger UI.** No additional
   annotations are needed. All existing DTO documentation and `DocumentBuilder` config
   carries over.

## Patterns

### Install Dependencies

```bash
pnpm add @scalar/nestjs-api-reference
# @nestjs/swagger is still required for spec generation
pnpm add @nestjs/swagger swagger-ui-express
```

### main.ts: Expose Spec at /api-json and Scalar at /docs

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (config.get('NODE_ENV') !== 'production') {
    const specBuilder = new DocumentBuilder()
      .setTitle(config.getOrThrow<string>('APP_NAME'))
      .setDescription('REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();

    const document = SwaggerModule.createDocument(app, specBuilder);

    // Expose raw JSON spec (Scalar reads from this URL)
    app.use('/api-json', (_req: unknown, res: { json: (d: unknown) => void }) => {
      res.json(document);
    });

    // Scalar API reference UI
    app.use(
      '/docs',
      apiReference({
        spec: { url: '/api-json' },
        theme: 'default',
        layout: 'modern',
        defaultHttpClient: {
          targetKey: 'javascript',
          clientKey: 'fetch',
        },
      }),
    );
  }

  await app.listen(config.getOrThrow<number>('PORT'));
}

bootstrap();
```

### Scalar with Authentication Pre-configured

```typescript
app.use(
  '/docs',
  apiReference({
    spec: { url: '/api-json' },
    authentication: {
      preferredSecurityScheme: 'access-token',
      http: {
        bearer: {
          token: '',  // user fills this in the UI
        },
      },
    },
  }),
);
```

### Running Both Scalar and Swagger UI (Migration Period)

```typescript
// Scalar at /docs (primary)
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));

// Swagger UI at /docs-swagger (legacy; remove after migration)
SwaggerModule.setup('docs-swagger', app, document);
```

### Custom Scalar Theme and Branding

```typescript
app.use(
  '/docs',
  apiReference({
    spec: { url: '/api-json' },
    theme: 'purple',           // options: default, alternate, moon, purple, solarized
    metaData: {
      title: 'My API Reference',
      description: 'Internal API documentation',
      ogTitle: 'My API',
    },
    hideDownloadButton: false,
    hideTestRequestButton: false,
  }),
);
```

## Anti-patterns

### Same Path for Scalar and Swagger UI

```typescript
// BAD — both try to serve on /docs; last one registered wins; the other breaks
SwaggerModule.setup('docs', app, document);
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));

// GOOD — different paths
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));
SwaggerModule.setup('docs-swagger', app, document);
```

### Scalar Without @nestjs/swagger (No Spec)

```typescript
// BAD — Scalar has no spec to render; page shows empty or errors
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));
// but /api-json endpoint is never set up

// GOOD — generate the document with @nestjs/swagger and expose it at /api-json
const document = SwaggerModule.createDocument(app, specBuilder);
app.use('/api-json', (_req, res) => res.json(document));
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));
```

### Enabling Scalar in Production

```typescript
// BAD — exposes full API surface publicly
app.use('/docs', apiReference({ spec: { url: '/api-json' } }));
// no environment guard

// GOOD — gate on non-production
if (config.get('NODE_ENV') !== 'production') {
  app.use('/docs', apiReference({ spec: { url: '/api-json' } }));
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Replacing Swagger UI | Install `@scalar/nestjs-api-reference`, move to `/docs` |
| Keeping both during migration | Scalar at `/docs`, Swagger UI at `/docs-swagger` |
| Spec generation | Always use `@nestjs/swagger` + `DocumentBuilder` |
| Pre-configuring auth in UI | Use `authentication.http.bearer` option |
| Production API explorer | Gate behind auth proxy or internal network only |
| Client SDK generation | Read from `/api-json` in CI pipeline |
