---
description: >
  Test-driven development workflow for NestJS. Writes failing E2E and unit tests
  first, then implements code to make them pass. Uses SuperTest, Testcontainers,
  and Jest. Triggers on: "write tests first", "tdd this", "test-driven",
  "write the test before code", "red-green-refactor".
---

# /tdd

## What

Implements features test-first using NestJS testing conventions. Writes a failing
SuperTest E2E test and a failing unit test, then implements the minimum code to make
both pass. Refactors with tests green. The cycle is: red → green → refactor.

## When

- "write tests first"
- "tdd this feature"
- "test-driven development"
- "write the test before the code"
- "red-green-refactor"
- New endpoints or service methods where correctness is critical

## How

### Step 1: Write Failing E2E Test

Create `src/<feature>/<feature>.e2e-spec.ts` using SuperTest + Testcontainers:

```typescript
it('createOrder_validPayload_returns201', async () => {
  // Arrange
  const dto = { customerId: 'c-1', items: [{ productId: 'p-1', qty: 2 }] };

  // Act
  const res = await request(app.getHttpServer()).post('/orders').send(dto);

  // Assert
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
});
```

Mirror production setup: `ValidationPipe`, `AllExceptionsFilter`, `helmet`.

### Step 2: Write Failing Unit Test

Create `src/<feature>/<feature>.service.spec.ts` with `createTestingModule`:

```typescript
it('createOrder_validInput_savesAndReturnsOrder', async () => {
  // Arrange
  mockRepo.save.mockResolvedValue({ id: 'o-1', ...dto });

  // Act
  const result = await service.create(dto);

  // Assert
  expect(result.id).toBe('o-1');
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining(dto));
});
```

### Step 3: Implement to Green

Run `npm test -- --testPathPattern=<feature>` to confirm both tests fail (red).

Implement the minimum code:
1. DTO with class-validator decorators
2. Service method with repository call
3. Controller endpoint calling the service

Run tests again — both should pass (green).

### Step 4: Refactor

With tests green, clean up:
- Extract magic values to constants
- Improve naming
- Apply de-sloppify if needed

Keep running tests. If any go red, revert and try again.

### Step 5: Full Verification

```bash
npm test -- --passWithNoTests
npm run build
```

## Example

```
Writing E2E test for POST /orders → 201 (red)
Writing unit test for OrdersService.create (red)

Implementing CreateOrderDto, OrdersService.create, OrdersController.create...

npm test: 2 passing (green)
Refactoring: extracted ORDER_STATUS_PENDING constant

npm test: 2 passing — done.
```

## Related

- `/scaffold` -- Generate the module skeleton before writing tests
- `/verify` -- Full pipeline check when the feature is complete
