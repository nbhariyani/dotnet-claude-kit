# NestJS Shared Library — Project Instructions

> Drop this file into your shared NestJS library project. Claude will follow these instructions automatically.

## Project Type

NestJS shared npm library. Reusable modules, DTOs, guards, decorators, and utilities consumed by multiple NestJS applications.

## When to Use This Pattern

- Sharing auth guards across multiple NestJS APIs
- Distributing common DTOs (pagination, error response, health)
- Publishing reusable interceptors, pipes, or filters
- Monorepo shared package (`libs/`) or standalone npm package

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11+ (peer dependency) |
| Language | TypeScript 5.x, strict mode |
| Build | `tsup` or `tsc` with declaration files |
| Exports | Named exports with `exports` map in `package.json` |
| Package manager | pnpm |
| Testing | Jest with `createTestingModule` |

## Project Structure

```
src/
  index.ts                      ← barrel — re-exports everything public
  auth/
    auth.module.ts
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
    decorators/
      current-user.decorator.ts
      public.decorator.ts
      roles.decorator.ts
    strategies/
      jwt.strategy.ts
  common/
    filters/
      all-exceptions.filter.ts
    interceptors/
      logging.interceptor.ts
      timeout.interceptor.ts
    pipes/
      parse-uuid.pipe.ts
    dto/
      pagination.dto.ts
      problem-details.dto.ts
  health/
    health.module.ts
    health.controller.ts
package.json
tsconfig.json
tsconfig.build.json
```

## package.json Conventions

```json
{
  "name": "@my-org/nestjs-shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "reflect-metadata": "^0.2.0"
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

## Module Export Rules

- **Always export modules, not just classes** — consumers import the module, not the class
- **Re-export from `src/index.ts`** — consumers use one import path
- **Mark peer deps, not direct deps** — `@nestjs/common` is a peer, not a dependency

```typescript
// src/auth/auth.module.ts
@Module({
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

// src/index.ts — barrel
export { AuthModule } from './auth/auth.module';
export { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
export { RolesGuard } from './auth/guards/roles.guard';
export { CurrentUser } from './auth/decorators/current-user.decorator';
export { Public } from './auth/decorators/public.decorator';
export { Roles } from './auth/decorators/roles.decorator';
export { PaginationDto } from './common/dto/pagination.dto';
export { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
```

## Consumer Usage

```typescript
// In a consuming API
import { AuthModule, PaginationDto, AllExceptionsFilter } from '@my-org/nestjs-shared';

@Module({ imports: [AuthModule] })
export class AppModule {}
```

## Versioning

- **Semantic versioning strictly** — breaking changes are major versions
- Breaking change: removing an export, changing a method signature, changing a DTO field shape
- Non-breaking: adding new exports, adding optional DTO fields
- **Never publish with a breaking change in a minor/patch bump**

## What Belongs in a Shared Library

| BELONGS | DOES NOT BELONG |
|---|---|
| Guards (JwtAuthGuard, RolesGuard) | Domain entities (Order, User) |
| Decorators (@Public, @CurrentUser, @Roles) | Business services (OrdersService) |
| Generic filters (AllExceptionsFilter) | Domain-specific logic |
| Generic interceptors (LoggingInterceptor) | Domain repositories |
| Pagination/Error DTOs | Feature-specific DTOs |
| HealthModule | Application configuration |

## Testing

- **Unit test every guard and interceptor** with `createTestingModule`
- **Never test implementation details** — test the behavior (canActivate returns true/false)

```typescript
describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const reflector = createMock<Reflector>();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = module.get(JwtAuthGuard);
  });

  it('canActivate_publicRoute_returnsTrue', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMock<ExecutionContext>();
    expect(guard.canActivate(context)).toBe(true);
  });
});
```

## Skills to Load

- `modern-typescript`
- `guards` — JwtAuthGuard, RolesGuard, CanActivate
- `interceptors` — LoggingInterceptor, TimeoutInterceptor
- `filters` — AllExceptionsFilter
- `pipes` — ParseUUIDPipe, custom pipes
- `dependency-injection` — module exports, provider patterns

## Agents to Use

- `/nestjs-architect` — Library API surface design
- `/api-designer` — DTO contracts
- `/test-engineer` — Guard and interceptor unit tests
