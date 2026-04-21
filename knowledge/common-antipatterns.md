# Common Anti-patterns

> Patterns that Claude tends to generate incorrectly. Every developer using `nestjs-claude-kit` should be protected from these mistakes.

## Orphaned Promises

**Problem:** Kicking off async work without `await` or explicit handling hides failures and creates race conditions.

```ts
// BAD
this.ordersService.syncOrder(orderId);
return { ok: true };

// GOOD
await this.ordersService.syncOrder(orderId);
return { ok: true };
```

## Direct `process.env` in Application Code

**Problem:** Reading environment variables directly spreads config logic across the codebase and makes testing harder.

```ts
// BAD
if (process.env.NODE_ENV === 'production') {
  // ...
}

// GOOD
if (this.configService.getOrThrow('NODE_ENV') === 'production') {
  // ...
}
```

## Business Logic in Controllers

**Problem:** Controllers should orchestrate HTTP concerns, not contain business rules, persistence, or heavy transformations.

```ts
// BAD
@Post()
async create(@Body() dto: CreateOrderDto) {
  const total = dto.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return this.orderRepository.save({ ...dto, total });
}

// GOOD
@Post()
create(@Body() dto: CreateOrderDto) {
  return this.ordersService.create(dto);
}
```

## Missing DTO Validation

**Problem:** Accepting unvalidated bodies lets bad data reach services and often turns 400-level problems into 500s.

```ts
// BAD
create(@Body() body: any) {
  return this.usersService.create(body);
}

// GOOD
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

## Returning ORM Entities Directly

**Problem:** Exposing raw entities leaks internal fields, couples APIs to persistence, and makes contract changes painful.

```ts
// BAD
return this.userRepository.findOneBy({ id });

// GOOD
const user = await this.userRepository.findOneByOrFail({ id });
return UserResponseDto.from(user);
```

## Cross-Module Private Imports

**Problem:** Importing another module's private files bypasses Nest module boundaries and creates fragile coupling.

```ts
// BAD
import { OrdersService } from '../orders/orders.service';

// GOOD
// Import the OrdersModule and consume exported providers through module boundaries.
```

## `synchronize: true` Outside Local Development

**Problem:** Automatic schema sync is convenient locally but dangerous in shared or production environments.

```ts
// BAD
TypeOrmModule.forRoot({
  synchronize: true,
});

// GOOD
TypeOrmModule.forRoot({
  synchronize: false,
  migrationsRun: false,
});
```

## Unbounded List Endpoints

**Problem:** Returning full tables without pagination can become an accidental denial-of-service path.

```ts
// BAD
return this.ordersRepository.find();

// GOOD
return this.ordersService.list({ page, limit });
```

## Broad Catch Blocks

**Problem:** Catching everything and flattening it into a generic response hides real bugs and breaks observability.

```ts
// BAD
try {
  return await this.paymentsService.charge(dto);
} catch (error) {
  return { ok: false };
}

// GOOD
try {
  return await this.paymentsService.charge(dto);
} catch (error) {
  if (error instanceof PaymentDeclinedError) {
    throw new BadRequestException(error.message);
  }
  throw error;
}
```

## Console Logging in App Code

**Problem:** `console.log` bypasses structured logging, correlation, and log-level control.

```ts
// BAD
console.log('Processing order', orderId);

// GOOD
this.logger.log(`Processing order ${orderId}`);
```

## Using `any` Across Boundaries

**Problem:** `any` removes the compiler's ability to protect service and controller contracts.

```ts
// BAD
async create(payload: any): Promise<any> {
  return this.repo.save(payload);
}

// GOOD
async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
  const order = await this.repo.save(mapCreateOrder(dto));
  return OrderResponseDto.from(order);
}
```

## Decision Guide

| Scenario | Preferred Pattern |
|---|---|
| Request body handling | DTO + validation decorators |
| Shared configuration | `ConfigService` |
| API response shape | Response DTOs, not entities |
| Cross-module collaboration | Module exports/contracts |
| Database changes | Migrations, not sync |
| Logging | Framework logger or structured logger |
| Async work in request flow | Await it or handle it explicitly |
