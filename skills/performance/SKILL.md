---
name: performance
description: >
  NestJS performance: Fastify adapter, compression, N+1 detection, DataLoader for
  batching, query optimization, clustering, and event loop analysis. Load when
  optimizing slow endpoints, investigating high latency, or preparing for production
  traffic.
  Trigger keywords: performance, slow, latency, N+1, query, Fastify, compression,
  cluster, DataLoader, memory, event loop, optimize, caching.
---

## Core Principles

1. **Never block the event loop.** No synchronous I/O, no CPU-heavy loops in request
   handlers. Rationale: Node.js is single-threaded; one blocking call freezes all
   concurrent requests.

2. **Fastify over Express for high-throughput APIs.** Drop-in NestJS adapter swap.
   Rationale: Fastify benchmarks 20-30% faster than Express due to schema-based
   serialization and reduced middleware overhead.

3. **Select only needed columns on list endpoints.** Never `findMany()` or `find()`
   without a `select` clause for list views. Rationale: fetching full entities for
   list/summary endpoints wastes memory and query time.

4. **Eliminate N+1 queries with joins or DataLoader.** Rationale: N+1 turns a
   single-page list into hundreds of database round trips — the primary cause of slow
   list endpoints under real traffic.

5. **Compress HTTP responses.** Enable `compression` middleware or Fastify's
   built-in compression. Rationale: JSON API payloads compress 60-80%; this
   meaningfully reduces bandwidth costs and client-perceived latency.

## Patterns

### Switch to Fastify adapter

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }), // nestjs-pino handles logging
  );

  // Fastify equivalent of compression — built-in via @fastify/compress
  await app.register(require('@fastify/compress'), { global: true });

  await app.listen(3000, '0.0.0.0');
}

bootstrap();
```

### Express compression middleware (if staying on Express)

```typescript
// main.ts
import compression from 'compression';

app.use(compression());
```

### Detect N+1 with TypeORM query logging

```typescript
// app.module.ts — enable logging in development to surface N+1
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.getOrThrow('DATABASE_URL'),
    logging: config.get('NODE_ENV') === 'development' ? ['query', 'warn'] : ['warn', 'error'],
    logger: 'advanced-console',
    autoLoadEntities: true,
    synchronize: false,
  }),
  inject: [ConfigService],
})
```

### Fix N+1 with TypeORM join

```typescript
// BAD — 1 query for orders + N queries for customer
const orders = await this.orderRepo.find();
for (const order of orders) {
  order.customer = await this.userRepo.findOne({ where: { id: order.customerId } });
}

// GOOD — single JOIN query
const orders = await this.orderRepo.find({
  relations: { customer: true },
  select: {
    id: true, status: true, total: true,
    customer: { id: true, name: true }, // select only needed customer fields
  },
});
```

### DataLoader for batching (GraphQL or repeated loads)

```typescript
// common/loaders/users.loader.ts
import DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';
import { UsersRepository } from '../../users/repositories/users.repository';
import type { User } from '../../users/entities/user.entity';

@Injectable({ scope: Scope.REQUEST }) // request-scoped — one per request
export class UsersLoader {
  readonly loader: DataLoader<string, User | null>;

  constructor(private readonly usersRepo: UsersRepository) {
    this.loader = new DataLoader<string, User | null>(
      async (ids: readonly string[]) => {
        const users = await this.usersRepo.findByIds([...ids]);
        const map = new Map(users.map(u => [u.id, u]));
        return ids.map(id => map.get(id) ?? null);
      },
    );
  }
}
```

### Clustering with Node.js cluster module

```typescript
// cluster.ts
import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  console.log(`Primary ${process.pid}: forking ${cpuCount} workers`);
  for (let i = 0; i < cpuCount; i++) cluster.fork();
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died — restarting`);
    cluster.fork();
  });
} else {
  // main.ts bootstrap runs in each worker
  import('./main').then(({ bootstrap }) => bootstrap());
}
```

### Response caching for stable data

```typescript
// Use @nestjs/cache-manager with Redis for list endpoints
@Get()
@UseInterceptors(CacheInterceptor)
@CacheKey('orders:list')
@CacheTTL(30) // seconds
findAll(@Query() query: PaginationDto) {
  return this.ordersService.findAll(query);
}
```

### Avoid synchronous I/O

```typescript
// BAD — blocks the event loop
import { readFileSync } from 'node:fs';
const template = readFileSync('./templates/invoice.html', 'utf-8');

// GOOD — async I/O, non-blocking
import { readFile } from 'node:fs/promises';
const template = await readFile('./templates/invoice.html', 'utf-8');
```

## Anti-patterns

### Select * for list endpoints

```typescript
// BAD — loads all columns including large text/JSONB per row
const orders = await this.prisma.order.findMany();

// GOOD — select only what the list view renders
const orders = await this.prisma.order.findMany({
  select: { id: true, status: true, total: true, createdAt: true },
});
```

### CPU work in a request handler

```typescript
// BAD — blocks Node.js event loop for duration of computation
@Get('report')
generateReport() {
  return heavyCsvProcessing(tenThousandRows); // synchronous, blocks all requests
}

// GOOD — offload to a worker thread or a BullMQ queue
@Post('report')
async requestReport(@Body() dto: ReportRequestDto) {
  await this.reportsQueue.add('generate', dto);
  return { status: 'queued' };
}
```

### In-process cache in multi-instance deployment

```typescript
// BAD — each instance has its own cache; invalidation is impossible
const cache = new Map<string, unknown>();

// GOOD — Redis cache shared across all instances
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore,
        host: 'redis',
        port: 6379,
        ttl: 30,
      }),
    }),
  ],
})
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| High-throughput API (>1k RPS) | Switch to Fastify adapter |
| Reduce response payload size | `compression` middleware or `@fastify/compress` |
| Slow list endpoint | Check for N+1; add `select` and `relations` |
| Repeated single-row lookups per request | DataLoader for batching |
| CPU-heavy computation in handler | Offload to BullMQ queue or worker thread |
| Multi-instance shared cache | Redis via `@nestjs/cache-manager` |
| Scale beyond one Node.js process | Cluster module or Kubernetes horizontal scaling |
| Profile event loop blockage | `0x` flame graphs or `clinic.js doctor` |
