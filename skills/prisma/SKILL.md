---
name: prisma
description: >
  Prisma ORM for NestJS: schema-first design, PrismaService, migrations with
  prisma migrate, typed CRUD operations, relations, transactions. Load when setting
  up a database with Prisma, writing repository logic, or managing migrations.
  Trigger keywords: Prisma, prisma migrate, PrismaService, schema.prisma, prisma
  generate, $transaction, include, select, Prisma Client, ORM.
---

## Core Principles

1. **PrismaService extends PrismaClient and implements OnModuleInit/OnModuleDestroy.**
   Rationale: NestJS lifecycle hooks ensure the connection opens on startup and closes
   cleanly on shutdown — prevents connection pool exhaustion in serverless environments.

2. **`prisma migrate dev` for development, `prisma migrate deploy` for production.**
   Never use `db push` in production. Rationale: `db push` bypasses the migration
   history and can destructively alter the schema without an audit trail.

3. **PrismaModule is global.** Rationale: every feature module needs database access.
   A global module avoids importing PrismaModule in every feature module.

4. **`$transaction` for multi-step operations.** Use the interactive client
   `$transaction(async (tx) => {...})` for operations that must succeed or fail
   together. Rationale: individual awaits without a transaction can leave the database
   in a partial state on failure.

5. **`select` for list queries; `include` for detail queries.** Rationale: `find()`
   without `select` loads all columns including large text fields, wasting memory and
   query time on list endpoints.

## Patterns

### schema.prisma

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id         String      @id @default(uuid())
  status     OrderStatus @default(PENDING)
  total      Decimal     @db.Decimal(10, 2)
  customerId String
  customer   User        @relation(fields: [customerId], references: [id])
  items      OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model OrderItem {
  id        String   @id @default(uuid())
  quantity  Int
  price     Decimal  @db.Decimal(10, 2)
  productId String
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  CANCELLED
}
```

### PrismaService

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

### PrismaModule (global)

```typescript
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### CRUD operations with typed Prisma Client

```typescript
// orders/orders.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, Order, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
  }): Promise<{ data: Pick<Order, 'id' | 'status' | 'total' | 'createdAt'>[]; total: number }> {
    const where: Prisma.OrderWhereInput = params.status ? { status: params.status } : {};
    const skip = (params.page - 1) * params.limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: params.limit,
        select: { id: true, status: true, total: true, createdAt: true }, // list: select only
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Order & { items: { quantity: number; price: Prisma.Decimal }[] } | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: { select: { id: true, name: true } } }, // detail: include relations
    });
  }

  async create(data: Prisma.OrderCreateInput): Promise<Order> {
    return this.prisma.order.create({ data });
  }

  async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
    return this.prisma.order.update({ where: { id }, data });
  }
}
```

### Interactive transaction

```typescript
async placeOrder(dto: CreateOrderDto): Promise<Order> {
  return this.prisma.$transaction(async tx => {
    const customer = await tx.user.findUniqueOrThrow({ where: { id: dto.customerId } });

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        items: {
          create: dto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        total: dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
        status: 'PENDING',
      },
    });

    await tx.inventory.updateMany({
      where: { productId: { in: dto.items.map(i => i.productId) } },
      data: { reserved: { increment: 1 } },
    });

    return order;
  });
}
```

### Migration commands

```bash
# Development — creates a migration file and applies it
npx prisma migrate dev --name add_order_notes_field

# Production — applies pending migrations (CI/CD)
npx prisma migrate deploy

# View migration status
npx prisma migrate status

# Reset dev database (drops + re-applies all migrations)
npx prisma migrate reset
```

## Anti-patterns

### Using db push in production

```bash
# BAD — overwrites schema without migration history, data loss risk
npx prisma db push

# GOOD — always use migrate deploy in production
npx prisma migrate deploy
```

### Creating PrismaClient per request

```typescript
// BAD — new connection pool per request, exhausts DB connections
@Injectable()
export class OrdersService {
  async findAll() {
    const prisma = new PrismaClient(); // new client every call
    return prisma.order.findMany();
  }
}

// GOOD — single PrismaService instance via DI
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.order.findMany();
  }
}
```

### Not disconnecting on app shutdown

```typescript
// BAD — PrismaClient with no lifecycle management leaks connections
export class PrismaService extends PrismaClient {} // no OnModuleDestroy

// GOOD
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

### findMany() without select on list endpoints

```typescript
// BAD — loads all columns including JSONB blobs for every row
return this.prisma.order.findMany();

// GOOD — select only what the list view needs
return this.prisma.order.findMany({
  select: { id: true, status: true, total: true, createdAt: true },
});
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New project, schema-first preference | Prisma |
| Existing DB, code-first preference | TypeORM |
| Local development schema change | `prisma migrate dev --name <desc>` |
| Production deployment | `prisma migrate deploy` (in CI/CD) |
| Multi-step atomic write | `$transaction(async tx => {...})` |
| List endpoint | `findMany` with `select` |
| Detail endpoint | `findUnique` with `include` |
| Count + paginated results | `$transaction([findMany, count])` |
