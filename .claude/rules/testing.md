---
alwaysApply: true
description: >
  NestJS testing rules: E2E-first strategy, real databases via Testcontainers,
  no SQLite in-memory, AAA pattern, and test naming conventions.
---

# Testing Rules (NestJS)

## E2E Tests First

- **DO** write SuperTest E2E tests before unit tests for HTTP-driven features.
  Rationale: A single E2E test covers routing, guards, pipes, interceptors, business
  logic, and database together — catching integration bugs that unit tests miss.

- **DO** use `@testcontainers/postgresql` for real PostgreSQL in E2E tests.
  Rationale: SQLite in-memory has different behavior from PostgreSQL (no transactions
  with proper isolation, no constraints, no JSON types, no serial/UUID defaults).

```typescript
// DO
const container = await new PostgreSqlContainer().start();

// DON'T
TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' })
```

## Test Structure

- **DO** follow the AAA pattern with blank lines separating each section.
  Rationale: Consistent structure makes tests readable and failures easy to locate.

```typescript
it('create_validRequest_returns201', async () => {
  // Arrange
  const dto = { customerId: 'c-1', items: [{ productId: 'p-1', qty: 2 }] };

  // Act
  const response = await request(app.getHttpServer()).post('/orders').send(dto);

  // Assert
  expect(response.status).toBe(201);
  expect(response.body.id).toBeDefined();
});
```

- **DO** name tests: `unitOfWork_stateOrInput_expectedBehavior`.
  Rationale: Test names are specifications. They must be greppable and self-documenting.

## Fixtures and Mocking

- **DO** use `beforeAll` (not `beforeEach`) for expensive setup like DB containers.
  Rationale: Starting a new container per test adds minutes of overhead.

- **DO** use `createTestingModule` with mock providers for unit tests.
  Rationale: Unit tests should be fast and isolated; real DI trees are slow.

- **DON'T** mock your own services in E2E tests.
  Rationale: E2E tests exist to test the real integration. Mocking defeats the purpose.

## Mirror Production Setup in E2E

- **DO** apply the same global pipes, filters, and interceptors in test setup.
  Rationale: Tests that don't apply `ValidationPipe` pass when the real app rejects
  the same request.

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
app.useGlobalFilters(new AllExceptionsFilter());
await app.init();
```

## Quick Reference

| Scenario | Recommendation |
|---|---|
| HTTP endpoint behavior | SuperTest E2E + Testcontainers |
| Service logic (no DB) | Unit test + `createTestingModule` + mock repo |
| Guard / interceptor | Unit test + mock `ExecutionContext` |
| Time-dependent logic | `jest.useFakeTimers()` |
| Expensive setup (DB) | `beforeAll` + `afterAll`, never `beforeEach` |
