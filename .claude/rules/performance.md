---
alwaysApply: true
description: >
  NestJS performance rules: no sync blocking in async contexts, CancellationToken
  equivalent, no N+1 queries, proper caching, and event loop hygiene.
---

# Performance Rules (NestJS)

## Async Patterns

- **`async/await` everywhere — no `.then()/.catch()` chains in service code.**
  Rationale: Mixed async styles hide errors and make code harder to reason about.

- **Never block the event loop with synchronous I/O.**
  Rationale: Node.js is single-threaded. `fs.readFileSync`, `execSync`, and CPU-heavy
  loops inside request handlers freeze all concurrent requests.

```typescript
// DO
const content = await fs.promises.readFile(path, 'utf-8');

// DON'T — blocks the event loop
const content = fs.readFileSync(path, 'utf-8');
```

- **Never use `.Result`, `.Wait()` equivalents — i.e. no `deasync` or synchronous
  wrappers over Promises.**

## Database

- **Select only needed columns for list endpoints.**
  Rationale: Loading full entities for list/summary views pulls unnecessary data,
  wastes memory, and increases query time.

- **No N+1 queries.** Use `relations`, `leftJoinAndSelect`, or DataLoader.
  Rationale: N+1 turns a 1-query endpoint into N+1 database round trips.

```typescript
// DO — one JOIN query
const orders = await repo.find({ relations: { items: true } });

// DON'T — one query per order
for (const order of orders) {
  order.items = await itemRepo.find({ where: { orderId: order.id } });
}
```

## HTTP Client

- **Use `@nestjs/axios` (HttpModule) — never `new HttpClient()` or `new axios()`.**
  Rationale: `HttpModule` shares Axios instances; creating instances per request
  exhausts connections and bypasses interceptors.

## Caching

- **Use `@nestjs/cache-manager` with Redis for shared caches.**
  Rationale: In-memory cache does not work in multi-instance deployments.

## DO / DON'T Quick Reference

| DO | DON'T |
|---|---|
| `await fs.promises.readFile(...)` | `fs.readFileSync(...)` in handlers |
| `repo.find({ relations: { items: true } })` | Loop with per-item query |
| `repo.find({ select: ['id', 'status'] })` | `repo.find()` for list endpoints |
| `HttpModule` via `@nestjs/axios` | `new axios()` or `require('axios')` per use |
| `@nestjs/cache-manager` + Redis | Node.js in-memory Map as cache |
