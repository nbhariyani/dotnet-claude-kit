---
name: verification-loop
description: >
  Verification workflow for NestJS code changes. Load this skill when verifying
  work is correct, checking the build, running tests before a PR, confirming
  a task is done, or running a green build check.
---

## Core Principles

1. **Never mark work complete without a green build.** A passing TypeScript compilation
   is the minimum bar. If `npm run build` fails, the task is not done.

2. **Use `get_diagnostics` MCP for fast feedback after small changes.** TypeScript
   diagnostics via ts-morph are faster than a full compilation and return structured
   data. Use the MCP tool first; fall back to full build for structural changes.

3. **Test failures are bugs, not noise.** If a test fails after your change and it
   was passing before, it is your responsibility to fix it before completing the task.

4. **Lint errors block PRs.** `npm run lint` with `--max-warnings 0` must pass.
   Lint suppressions (`eslint-disable`) must have a justification comment.

5. **The full verification sequence runs in order.** Lint → Unit Tests → Build → E2E.
   Skipping steps is how regressions reach production.

## Patterns

### Full Verification Sequence

```bash
# Step 1: fix auto-fixable lint issues
npm run lint:fix

# Step 2: verify lint is clean (0 warnings, 0 errors)
npm run lint

# Step 3: unit tests (fast; run in watch mode during dev)
npm run test

# Step 4: TypeScript compilation
npm run build

# Step 5: E2E tests (requires DB; slower)
npm run test:e2e
```

One-liner for pre-PR verification:
```bash
npm run lint && npm test && npm run build && npm run test:e2e
```

### Fast Check After a Small Edit (MCP)

Use the `get_diagnostics` tool from cwm-ts-navigator when you want TypeScript
feedback without a full compilation:

```
get_diagnostics({ filePath: "src/orders/orders.service.ts" })
```

Returns structured TypeScript errors with line numbers. Faster than `npm run build`
for targeted checks.

### Common Build Errors and Fixes

**Missing `reflect-metadata` import**
```typescript
// Error: Reflect.metadata is not a function
// Fix: add as the first import in main.ts
import 'reflect-metadata';
```

**Missing `emitDecoratorMetadata` in tsconfig.json**
```json
// Error: DI injection fails silently; dependencies are undefined
// Fix: add to tsconfig.json compilerOptions
{
  "emitDecoratorMetadata": true,
  "experimentalDecorators": true
}
```

**Unregistered module causes `Nest can't resolve dependencies`**
```typescript
// Error: Nest can't resolve dependencies of OrdersService (?).
// Fix: check that the module providing the dependency is imported
@Module({
  imports: [TypeOrmModule.forFeature([Order])], // required for @InjectRepository
  providers: [OrdersService],
})
export class OrdersModule {}
```

**Circular dependency detected**
```typescript
// Error: A circular dependency has been detected (OrdersModule -> PaymentsModule -> OrdersModule)
// Fix: extract shared dependency into a third module
// Only use forwardRef() as last resort
```

**`@Column` missing on entity property**
```typescript
// Error: column "foo" of relation "orders" does not exist
// Fix: add TypeORM decorator
@Column()
status: string;
```

### Checking for Type Errors After Refactor

```bash
# Type-check without emitting files (fastest full project check)
npx tsc --noEmit

# Check a specific file (via ts-morph MCP)
get_diagnostics({ filePath: "src/orders/orders.service.ts" })
```

### Verifying Test Coverage Is Not Degraded

```bash
# Run tests with coverage report
npm run test:cov

# Check coverage thresholds (configured in jest.config.ts)
# Fail if lines < 80%, branches < 70%
```

```typescript
// jest.config.ts
export default {
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
      functions: 80,
    },
  },
};
```

## Anti-patterns

### Marking Done Without Running Tests

```
// BAD — "I've implemented the feature, it looks correct"
// GOOD — run npm test; if tests fail, fix them; then mark done
```

### Silencing Lint Errors Instead of Fixing

```typescript
// BAD — suppression without justification masks real issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = response.data;

// GOOD — fix the underlying issue
const data: OrderResponse = response.data as OrderResponse;
```

### Using SQLite for Local E2E (then surprised by CI failure)

```typescript
// BAD — passes locally on SQLite, fails in CI on PostgreSQL
TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' })

// GOOD — use Testcontainers locally too, or run docker-compose up before tests
const container = await new PostgreSqlContainer().start();
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| After small edit (1-2 files) | `get_diagnostics` MCP tool |
| After structural change (new module) | `npm run build` |
| Before opening a PR | Full sequence: lint + test + build + e2e |
| Test fails after my change | Fix the test or the code; never skip |
| Lint warning on new code | Fix it; do not add eslint-disable |
| Coverage drops below threshold | Add tests to cover the new code paths |
| Build passes but app crashes at start | Check ConfigService startup validation errors |
