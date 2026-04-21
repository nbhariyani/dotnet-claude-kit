---
name: caching
description: >
  Caching patterns for NestJS using @nestjs/cache-manager, Redis, and ioredis.
  Load this skill when working with cache, caching, redis, CacheModule, @CacheKey,
  @CacheTTL, cache invalidation, or cache-manager.
---

## Core Principles

1. **Redis for all shared caches.** In-memory caching (`store: 'memory'`) breaks
   horizontal scaling — each instance has a different cache state. Use Redis as the
   shared backing store for any multi-instance deployment.

2. **Never cache mutating endpoints.** Only GET handlers should be decorated with
   `@UseInterceptors(CacheInterceptor)`. Caching POST/PUT/PATCH/DELETE responses is
   always wrong.

3. **Invalidate after every write.** Cache entries must be deleted or updated whenever
   the underlying data changes. Stale reads are a correctness bug, not just a
   performance issue.

4. **Set TTLs intentionally.** Every cached item needs an explicit TTL based on
   acceptable staleness. Relying on default TTLs leads to items living longer or
   shorter than intended.

5. **Cache at the service layer for fine-grained control.** `CACHE_MANAGER` injection
   gives control over key naming, TTL, and invalidation logic that declarative
   interceptors cannot provide.

## Patterns

### CacheModule Setup with Redis (ioredis)

```typescript
// src/app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
          tls: config.get('NODE_ENV') === 'production' ? {} : undefined,
        }),
        ttl: 60_000, // default 60 s in milliseconds
      }),
    }),
  ],
})
export class AppModule {}
```

### Declarative Caching on Controller Methods

```typescript
import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('products')
@UseInterceptors(CacheInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Cache key derived from route; TTL 5 minutes
  @Get()
  @CacheTTL(300_000)
  findAll() {
    return this.productsService.findAll();
  }

  // Custom key so invalidation can target it precisely
  @Get(':id')
  @CacheKey('product-by-id')
  @CacheTTL(600_000)
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }
}
```

### Manual Cache with CACHE_MANAGER Injection

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async findById(id: string): Promise<Product> {
    const key = `product:${id}`;
    const cached = await this.cache.get<Product>(key);
    if (cached) return cached;

    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    await this.cache.set(key, product, 600_000); // 10 minutes
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productsRepository.update(id, dto);
    await this.cache.del(`product:${id}`);  // invalidate on write
    return product;
  }

  async delete(id: string): Promise<void> {
    await this.productsRepository.delete(id);
    await this.cache.del(`product:${id}`);
  }
}
```

### Cache Invalidation After Mutations (Controller-Level)

```typescript
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsService.create(dto);
    await this.cache.del('products:all');  // bust list cache
    return ProductResponseDto.from(product);
  }
}
```

## Anti-patterns

### In-Memory Cache in Multi-Instance Deployment

```typescript
// BAD — each pod has its own in-memory store; cache misses on every other request
CacheModule.register({ ttl: 60_000 })
// or
CacheModule.register({ store: 'memory', ttl: 60_000 })

// GOOD — Redis shared across all instances
CacheModule.registerAsync({
  useFactory: async (config: ConfigService) => ({
    store: await redisStore({ host: config.getOrThrow('REDIS_HOST') }),
  }),
  inject: [ConfigService],
})
```

### Caching POST/PUT Endpoints

```typescript
// BAD — caches mutation responses; subsequent GET returns stale create/update result
@Post()
@UseInterceptors(CacheInterceptor)  // never on POST/PUT/PATCH/DELETE
@CacheTTL(60_000)
create(@Body() dto: CreateProductDto) { ... }

// GOOD — only GET endpoints use CacheInterceptor
@Get()
@UseInterceptors(CacheInterceptor)
@CacheTTL(60_000)
findAll() { ... }
```

### Never Invalidating After Writes

```typescript
// BAD — cache serves stale data indefinitely until TTL expires
async update(id: string, dto: UpdateProductDto): Promise<Product> {
  return this.repo.update(id, dto);
  // cache entry for product:${id} still exists with old data
}

// GOOD — explicit invalidation
async update(id: string, dto: UpdateProductDto): Promise<Product> {
  const product = await this.repo.update(id, dto);
  await this.cache.del(`product:${id}`);
  return product;
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Single-instance, development only | `store: 'memory'` acceptable |
| Multi-instance / Kubernetes | Redis via `cache-manager-ioredis-yet` |
| Simple read endpoint caching | `@UseInterceptors(CacheInterceptor)` + `@CacheTTL` |
| Fine-grained key control | Inject `CACHE_MANAGER`, use `get/set/del` manually |
| Cache invalidation after write | `cache.del(key)` in the service method after DB write |
| Caching expensive DB aggregations | Manual cache in service layer with named keys |
| Session storage | Use ioredis directly, not cache-manager |
