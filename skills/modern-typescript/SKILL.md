---
name: modern-typescript
description: >
  TypeScript 5.x idioms for NestJS: strict mode, satisfies operator, const type
  params, template literal types, discriminated unions, type narrowing, and
  class-validator integration. Load this skill first before any other NestJS skill.
  Trigger keywords: TypeScript, types, strict, interface, generics, satisfies, union,
  type narrowing, unknown, readonly.
---

## Core Principles

1. **Strict mode is non-negotiable.** `tsconfig.json` must have `"strict": true` plus
   `"noUncheckedIndexedAccess": true`. Rationale: catches null dereferences, implicit
   `any`, and unsafe index access at compile time, not runtime.

2. **`const` over `let`, never `var`.** Use `let` only when reassignment is
   required. Rationale: immutability by default prevents accidental mutation and
   communicates intent.

3. **Explicit return types on all public methods.** Rationale: serves as an API
   contract, catches accidental signature changes during refactors.

4. **`interface` for public contracts, `type` for unions and intersections.**
   Rationale: interfaces are open for extension (declaration merging), types express
   composition. Using each for its intended purpose makes the semantic intent clear.

5. **`unknown` instead of `any` in catch blocks and external boundaries.**
   Rationale: `any` disables type checking entirely; `unknown` forces explicit narrowing
   before use, which is the safe default.

## Patterns

### Strict tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  }
}
```

### `satisfies` for NestJS config objects

Validates against a type without widening — keeps literal types for downstream use.

```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const databaseConfig = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  synchronize: false,
  migrationsRun: true,
} satisfies TypeOrmModuleOptions;
// `databaseConfig.type` is 'postgres', not string
```

### Discriminated unions for typed domain errors

Avoid throwing for expected failures — use a result type instead.

```typescript
type OrderResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: 'OUT_OF_STOCK' | 'PAYMENT_FAILED' | 'INVALID_ADDRESS' };

// In service:
async placeOrder(dto: CreateOrderDto): Promise<OrderResult> {
  const inStock = await this.inventory.check(dto.items);
  if (!inStock) return { ok: false, reason: 'OUT_OF_STOCK' };
  const order = await this.repo.create(dto);
  return { ok: true, orderId: order.id };
}

// In controller — exhaustive narrowing:
const result = await this.ordersService.placeOrder(dto);
if (!result.ok) {
  switch (result.reason) {
    case 'OUT_OF_STOCK': throw new ConflictException('Item out of stock');
    case 'PAYMENT_FAILED': throw new PaymentRequiredException();
    case 'INVALID_ADDRESS': throw new BadRequestException('Invalid address');
  }
}
return result;
```

### Template literal types for route strings

```typescript
type ApiVersion = 'v1' | 'v2';
type Resource = 'orders' | 'users' | 'products';
type ApiRoute = `/${ApiVersion}/${Resource}`;
// Type: '/v1/orders' | '/v1/users' | '/v1/products' | '/v2/orders' | ...
```

### Generic repository constraint

```typescript
interface Entity {
  id: string;
}

interface Repository<T extends Entity> {
  findById(id: T['id']): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: T['id']): Promise<void>;
}
```

### `readonly` on injected dependencies

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}
}
```

### Type narrowing with `unknown` in catch

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('PaymentsService');

try {
  await this.gateway.charge(amount);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Charge failed: ${message}`);
  throw new ServiceUnavailableException('Payment gateway error');
}
```

### Const type parameters (TypeScript 5.0+)

```typescript
function createRoute<const T extends string>(path: T): T {
  return path;
}

const route = createRoute('/orders/:id');
// Type: '/orders/:id' — not widened to string
```

### Optional chaining and nullish coalescing

```typescript
// DO
const city = user?.address?.city ?? 'Unknown';
const timeout = config.get<number>('HTTP_TIMEOUT') ?? 5000;

// Combining with type narrowing
const role = user?.roles?.[0] ?? 'guest';
```

## Anti-patterns

### `any` disables type safety

```typescript
// BAD
async findUser(id: any): Promise<any> {
  return this.repo.findOne(id);
}

// GOOD
async findUser(id: string): Promise<User | null> {
  return this.repo.findOne({ where: { id } });
}
```

### Non-null assertion without a guard

```typescript
// BAD — throws at runtime if user is null
const email = user!.email;

// GOOD — explicit guard communicates the invariant
if (!user) throw new NotFoundException('User not found');
const email = user.email;
```

### `var` and implicit widening

```typescript
// BAD
var status = 'pending';
let result;

// GOOD
const status = 'pending' as const; // literal type 'pending'
const result: Order | null = null;
```

### Untyped catch blocks

```typescript
// BAD
try { ... } catch (e) {
  console.log(e.message); // implicit any — runtime error if e is not Error
}

// GOOD
try { ... } catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  this.logger.error(message);
}
```

### Type assertions instead of narrowing

```typescript
// BAD
const order = response as Order; // bypasses type checking

// GOOD — validate at boundary with class-transformer
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
const order = plainToInstance(Order, response);
await validateOrReject(order);
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Shape of an API response or service contract | `interface` |
| Union of string literals (status, role) | `type` with string union |
| Expected domain failures | Discriminated union result type |
| Config object that must match a framework type | `satisfies` |
| Injected dependency in a class | `private readonly` property |
| External data (API response, DB row) | Validate with class-validator + `plainToInstance` |
| Error caught in try-catch | Type as `unknown`, narrow before use |
| Constant path or key string | `const` assertion or const type param |
