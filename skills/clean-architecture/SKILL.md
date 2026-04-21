---
name: clean-architecture
description: >
  NestJS Clean Architecture: Domain layer (entities, value objects), Application
  layer (use cases), Infrastructure layer (TypeORM/Prisma repositories, HTTP adapters).
  Dependency rule: outer layers depend on inner layers, never the reverse. Load when
  structuring a project with complex domain logic or when separating business rules
  from infrastructure concerns.
  Trigger keywords: clean architecture, use case, domain entity, value object, domain
  service, repository interface, dependency inversion, DIP, layers, inner, outer.
---

## Core Principles

1. **The dependency rule is absolute.** Domain layer imports nothing from NestJS,
   TypeORM, or any framework. Application layer knows domain, not infrastructure.
   Infrastructure knows everything. Rationale: if the domain imports TypeORM, you
   cannot test domain logic without a database.

2. **Domain entities are plain TypeScript classes.** No decorators, no ORM
   annotations, no framework imports. Rationale: pure classes are testable without any
   runtime setup and survive ORM migrations without modification.

3. **Repositories are interfaces in the domain, implementations in infrastructure.**
   Domain code depends on `OrdersRepository` (interface). TypeORM implementation lives
   in infrastructure. Rationale: this is the Dependency Inversion Principle —
   high-level policy does not depend on low-level details.

4. **Use cases are the application's public API.** Each use case class has a single
   `execute()` method. No use case imports another use case. Rationale: keeps scope
   small and prevents hidden coupling between application flows.

5. **Controllers are delivery mechanisms only.** Extract HTTP input, call a use case,
   map result to HTTP response. Zero business logic. Rationale: the same use case must
   be callable from HTTP, CLI, or a message queue without modification.

## Patterns

### Folder structure

```
src/
  domain/
    orders/
      order.entity.ts            ← pure TypeScript class
      order-item.value-object.ts
      order-status.ts
      orders.repository.ts       ← interface + injection token
  application/
    orders/
      use-cases/
        place-order.use-case.ts
        cancel-order.use-case.ts
      dto/
        place-order.command.ts
  infrastructure/
    persistence/
      orders/
        typeorm-order.entity.ts  ← ORM entity (separate from domain entity)
        typeorm-orders.repository.ts
        orders-persistence.module.ts
    http/
      orders/
        orders.controller.ts
        orders.module.ts
  app.module.ts
  main.ts
```

### Domain entity — zero framework dependencies

```typescript
// domain/orders/order.entity.ts
import { OrderItem } from './order-item.value-object';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'CANCELLED';

export class Order {
  private readonly _items: OrderItem[];
  private _status: OrderStatus;

  constructor(
    readonly id: string,
    readonly customerId: string,
    items: OrderItem[],
    status: OrderStatus = 'PENDING',
  ) {
    if (items.length === 0) throw new Error('Order must have at least one item');
    this._items = [...items];
    this._status = status;
  }

  get items(): readonly OrderItem[] { return this._items; }
  get status(): OrderStatus { return this._status; }
  get total(): number {
    return this._items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  confirm(): void {
    if (this._status !== 'PENDING') throw new Error('Only pending orders can be confirmed');
    this._status = 'CONFIRMED';
  }

  cancel(): void {
    if (this._status === 'SHIPPED') throw new Error('Cannot cancel a shipped order');
    this._status = 'CANCELLED';
  }
}
```

### Value Object

```typescript
// domain/orders/order-item.value-object.ts
export class OrderItem {
  constructor(
    readonly productId: string,
    readonly quantity: number,
    readonly price: number,
  ) {
    if (quantity < 1) throw new Error('Quantity must be at least 1');
    if (price < 0) throw new Error('Price cannot be negative');
  }

  equals(other: OrderItem): boolean {
    return this.productId === other.productId &&
      this.quantity === other.quantity &&
      this.price === other.price;
  }
}
```

### Repository interface with injection token

```typescript
// domain/orders/orders.repository.ts
import type { Order } from './order.entity';

export interface OrdersRepository {
  findById(id: string): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}

export const ORDERS_REPOSITORY = Symbol('OrdersRepository');
```

### Use case

```typescript
// application/orders/use-cases/place-order.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { ORDERS_REPOSITORY, OrdersRepository } from '../../../domain/orders/orders.repository';
import { Order } from '../../../domain/orders/order.entity';
import { OrderItem } from '../../../domain/orders/order-item.value-object';
import type { PlaceOrderCommand } from '../dto/place-order.command';

@Injectable()
export class PlaceOrderUseCase {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepo: OrdersRepository,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<string> {
    const items = command.items.map(
      i => new OrderItem(i.productId, i.quantity, i.price),
    );
    const order = new Order(crypto.randomUUID(), command.customerId, items);
    await this.ordersRepo.save(order);
    return order.id;
  }
}
```

### TypeORM repository implementing the domain interface

```typescript
// infrastructure/persistence/orders/typeorm-orders.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersRepository } from '../../../domain/orders/orders.repository';
import { Order } from '../../../domain/orders/order.entity';
import { OrderItem } from '../../../domain/orders/order-item.value-object';
import { TypeOrmOrderEntity } from './typeorm-order.entity';

@Injectable()
export class TypeOrmOrdersRepository implements OrdersRepository {
  constructor(
    @InjectRepository(TypeOrmOrderEntity)
    private readonly repo: Repository<TypeOrmOrderEntity>,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.repo.findOne({ where: { id }, relations: { items: true } });
    if (!row) return null;
    return new Order(
      row.id,
      row.customerId,
      row.items.map(i => new OrderItem(i.productId, i.quantity, i.price)),
      row.status,
    );
  }

  async save(order: Order): Promise<void> {
    await this.repo.save({
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      total: order.total,
    });
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const rows = await this.repo.find({ where: { customerId }, relations: { items: true } });
    return rows.map(row => new Order(
      row.id, row.customerId,
      row.items.map(i => new OrderItem(i.productId, i.quantity, i.price)),
      row.status,
    ));
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
```

### NestJS module — binds interface token to implementation

```typescript
// infrastructure/persistence/orders/orders-persistence.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ORDERS_REPOSITORY } from '../../../domain/orders/orders.repository';
import { TypeOrmOrdersRepository } from './typeorm-orders.repository';
import { TypeOrmOrderEntity } from './typeorm-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmOrderEntity])],
  providers: [
    { provide: ORDERS_REPOSITORY, useClass: TypeOrmOrdersRepository },
  ],
  exports: [ORDERS_REPOSITORY],
})
export class OrdersPersistenceModule {}
```

## Anti-patterns

### Framework imports in the domain layer

```typescript
// BAD — domain entity coupled to TypeORM; cannot test without database
import { Entity, Column } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Entity()
@Injectable()
export class Order { ... }

// GOOD — pure TypeScript, zero framework imports
export class Order {
  constructor(readonly id: string, readonly customerId: string) {}
}
```

### Business logic in the controller

```typescript
// BAD — domain rules in the HTTP adapter
@Post()
async create(@Body() dto: CreateOrderDto) {
  if (dto.items.length === 0) throw new BadRequestException('No items');
  const total = dto.items.reduce((s, i) => s + i.price, 0);
  return this.service.create({ ...dto, total });
}

// GOOD — controller delegates; domain entity enforces invariants
@Post()
create(@Body() dto: PlaceOrderCommand) {
  return this.placeOrderUseCase.execute(dto);
}
```

### Use case importing another use case

```typescript
// BAD — hidden coupling, use cases should be independent
@Injectable()
export class CheckoutUseCase {
  constructor(private readonly placeOrder: PlaceOrderUseCase) {} // wrong
}

// GOOD — share domain services or repositories via injection tokens
@Injectable()
export class CheckoutUseCase {
  constructor(
    @Inject(ORDERS_REPOSITORY) private readonly ordersRepo: OrdersRepository,
    @Inject(PAYMENTS_REPOSITORY) private readonly paymentsRepo: PaymentsRepository,
  ) {}
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Simple CRUD, no business rules | Feature Modules (skip Clean Architecture overhead) |
| Complex domain invariants | Domain entity with private state + enforce in methods |
| Swap ORM later | Repository interface in domain, bind implementation via DI token |
| Test domain logic without DB | Mock `OrdersRepository` via injection token |
| Multiple delivery channels (HTTP + CLI) | Same use case, different controllers |
| Read-only queries | Query directly from infrastructure; no use case needed |
