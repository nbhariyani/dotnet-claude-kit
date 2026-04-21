---
alwaysApply: true
description: >
  TypeScript and NestJS coding style conventions: strict mode, const/let,
  interfaces, decorators, naming, file organization, and formatting standards.
---

# TypeScript / NestJS Coding Style

## File Organization

- **One class per file.** File name must match the exported class name exactly
  (`orders.service.ts` exports `OrdersService`).
- **Feature-first folder structure.** Group by domain (`orders/`, `users/`), not by
  type (`controllers/`, `services/`).
- **Suffix conventions:** `*.controller.ts`, `*.service.ts`, `*.module.ts`,
  `*.entity.ts`, `*.dto.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.pipe.ts`,
  `*.filter.ts`, `*.spec.ts`, `*.e2e-spec.ts`.

## Type Declarations

- **`const` over `let`, never `var`.** `let` only when reassignment is required.
- **Explicit return types on public methods.** TypeScript infers return types, but
  explicit annotations serve as API contracts and catch accidental changes.

```typescript
// DO
async findById(id: string): Promise<Order> { ... }

// DON'T
async findById(id: string) { ... } // return type hidden
```

- **`interface` for public contracts, `type` for unions/intersections.**

```typescript
// DO — interface for shape contracts
interface OrderRepository { findById(id: string): Promise<Order | null>; }

// DO — type for unions
type OrderStatus = 'pending' | 'shipped' | 'cancelled';
```

- **`readonly` on class properties that should not be reassigned.**
- **`satisfies` operator to validate object literals against a type without widening.**

```typescript
const config = {
  maxRetries: 3,
  timeoutMs: 5000,
} satisfies AppConfig;
```

## Naming

- **PascalCase** for classes, interfaces, enums, decorators.
- **camelCase** for variables, functions, method names, and properties.
- **SCREAMING_SNAKE_CASE** for module-level constants and injection tokens.
- **Async suffix on all async methods** — `findByIdAsync` is wrong NestJS convention;
  use `findById` and let the `Promise` return type communicate async nature.
- **No `I` prefix on interfaces** — `OrderRepository`, not `IOrderRepository`.

## Expressions and Patterns

- **Optional chaining and nullish coalescing** over nested if-null checks.

```typescript
// DO
const city = user?.address?.city ?? 'Unknown';

// DON'T
const city = user && user.address && user.address.city ? user.address.city : 'Unknown';
```

- **Arrow functions for callbacks.** Named functions for top-level module-scope
  functions, class methods, and anything that needs `this` binding explicitly.
- **Template literals over string concatenation** for any multi-part string.
- **`async/await` over `.then()/.catch()` chains** for all async code.
- **Strict mode required.** `tsconfig.json` must have `"strict": true`.

## DO / DON'T Quick Reference

| DO | DON'T |
|---|---|
| `const x = ...` | `var x = ...` or unnecessary `let` |
| `interface Shape { ... }` for contracts | `IShape` prefix |
| `async findById(): Promise<X>` | Missing return type on public methods |
| `user?.roles ?? []` | `user && user.roles ? user.roles : []` |
| `@Injectable()` on all providers | Missing decorator causing DI errors |
| `private readonly repo: Repository<X>` | Mutable injected dependencies |
