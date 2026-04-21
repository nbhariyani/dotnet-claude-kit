---
name: testing
description: >
  NestJS testing strategy using Jest, SuperTest, and Testcontainers.
  Covers Test.createTestingModule() for unit tests, SuperTest E2E tests against
  a real NestJS application, Testcontainers for real database testing, and the
  AAA pattern with clear naming conventions.
  Load this skill when writing tests, setting up test infrastructure, reviewing
  test coverage, or when the user mentions "test", "Jest", "SuperTest",
  "Testcontainers", "integration test", "unit test", "e2e test",
  "createTestingModule", "spec", "mock provider", or "test coverage".
---

# Testing (NestJS)

## Core Principles

1. **E2E tests are the highest-value tests** — A single SuperTest E2E test covers
   routing, guards, interceptors, pipes, business logic, and persistence in one shot.
   Start here before unit tests for HTTP-driven features.
2. **Real databases in E2E tests** — Use `@testcontainers/postgresql` for real
   PostgreSQL. SQLite in-memory hides real bugs (transactions, constraints, query plans).
3. **AAA pattern is mandatory** — Every test has three clearly separated sections:
   Arrange / Act / Assert, separated by blank lines.
4. **Test behavior, not implementation** — Assert on HTTP responses and database state,
   not on which internal methods were called.
5. **Share expensive fixtures** — Start database containers in `beforeAll`, not
   `beforeEach`. One container per test suite, not per test.

## Patterns

### E2E Test with SuperTest + Testcontainers

```typescript
// test/orders.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_URL')
      .useValue(container.getConnectionUri())
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = module.get(DataSource);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE orders CASCADE');
  });

  it('POST /orders_validRequest_returns201', async () => {
    // Arrange
    const dto = { customerId: 'cust-1', items: [{ productId: 'p-1', qty: 2 }] };

    // Act
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(dto)
      .expect(201);

    // Assert
    expect(response.body.id).toBeDefined();
    expect(response.body.customerId).toBe('cust-1');
  });

  it('POST /orders_emptyItems_returns400', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cust-1', items: [] })
      .expect(400);

    expect(response.body.message).toBeDefined();
  });
});
```

### Unit Test with createTestingModule

Use for service logic that does not require a real database.

```typescript
// orders/orders.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';

describe('OrdersService', () => {
  let service: OrdersService;
  const mockRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create_validDto_savesAndReturns', async () => {
    // Arrange
    const dto = { customerId: 'cust-1', items: [{ productId: 'p-1', qty: 2 }] };
    mockRepo.save.mockResolvedValue({ id: 'order-1', ...dto });

    // Act
    const result = await service.create(dto);

    // Assert
    expect(result.id).toBe('order-1');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('findById_nonExistentId_returnsNull', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const result = await service.findById('missing-id');
    expect(result).toBeNull();
  });
});
```

### Testing Guards

```typescript
// common/guards/jwt-auth.guard.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    guard = new JwtAuthGuard(reflector);
  });

  it('canActivate_publicRoute_returnsTrue', () => {
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
```

### Test Naming Convention

`unitOfWork_stateOrInput_expectedBehavior`:

```
create_validDto_returns201
create_missingField_returns400
findById_nonExistentId_returnsNull
cancel_alreadyShipped_throwsConflict
```

## Anti-patterns

### Don't Use SQLite In-Memory for E2E Tests

```typescript
// BAD — hides PostgreSQL behavior: constraints, transactions, JSON types
TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' })

// GOOD
const container = await new PostgreSqlContainer().start();
```

### Don't Test Internal Implementation

```typescript
// BAD — breaks on any refactor even if behavior is unchanged
expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));

// GOOD — assert observable outcome
const order = await dataSource.getRepository(Order).findOne({ where: { id } });
expect(order.status).toBe('pending');
```

### Don't Start Containers per Test

```typescript
// BAD — one container per test = minutes of overhead
beforeEach(async () => { container = await new PostgreSqlContainer().start(); });

// GOOD — share one container across the suite
beforeAll(async () => { container = await new PostgreSqlContainer().start(); });
```

### Don't Skip Global Pipes in E2E Setup

```typescript
// BAD — ValidationPipe missing; test passes, prod rejects the same request
app = module.createNestApplication();
await app.init();

// GOOD — mirror production setup exactly
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| HTTP endpoint (routing + guards + validation + DB) | SuperTest E2E + Testcontainers |
| Service business logic (no DB needed) | Unit test with `createTestingModule` + mock repo |
| Guard / interceptor behavior | Unit test with mock `ExecutionContext` |
| Time-dependent logic | `jest.useFakeTimers()` |
| External HTTP calls | `nock` or Mock Service Worker (`msw`) |
| Shared expensive setup (DB container) | `beforeAll` + `afterAll` |
| Parameterized test cases | `test.each` / `it.each` |
