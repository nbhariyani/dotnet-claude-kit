---
name: ddd
description: >
  Domain-Driven Design patterns for NestJS. Load this skill when working with
  aggregates, value objects, domain events, bounded contexts, repository pattern,
  ubiquitous language, or anemic domain model concerns.
---

## Core Principles

1. **Aggregates enforce invariants.** The aggregate root is the only entry point for
   mutations. Use a private constructor and a static `create()` factory that validates
   business rules before constructing the object.

2. **Value objects are immutable.** They have no identity — equality is structural.
   Implement `equals()` and expose a static `create()` that validates and constructs.

3. **Domain events decouple side effects.** Emit events from the aggregate root after
   state changes. Subscribers (email, audit log, projections) react without coupling
   to the domain layer.

4. **Repository interfaces live in the domain layer.** TypeORM/Prisma implementations
   live in infrastructure. Domain code never imports ORM types.

5. **The application layer orchestrates.** Services in `application/` call domain
   objects and repository interfaces. They hold no business logic themselves.

## Patterns

### Aggregate Root

```typescript
// src/orders/domain/order.ts
import { randomUUID } from 'crypto';
import { OrderItem } from './order-item.value-object';
import { OrderCreatedEvent } from './events/order-created.event';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';

export class Order {
  private readonly _domainEvents: object[] = [];

  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    private _items: OrderItem[],
    private _status: OrderStatus,
  ) {}

  static create(customerId: string, items: OrderItem[]): Order {
    if (!customerId) throw new Error('customerId is required');
    if (items.length === 0) throw new Error('Order must have at least one item');

    const order = new Order(randomUUID(), customerId, [...items], 'pending');
    order._domainEvents.push(new OrderCreatedEvent(order.id, customerId));
    return order;
  }

  confirm(): void {
    if (this._status !== 'pending') {
      throw new Error(`Cannot confirm order in status: ${this._status}`);
    }
    this._status = 'confirmed';
  }

  cancel(): void {
    if (this._status === 'shipped') {
      throw new Error('Cannot cancel a shipped order');
    }
    this._status = 'cancelled';
  }

  get status(): OrderStatus { return this._status; }
  get items(): ReadonlyArray<OrderItem> { return this._items; }

  pullDomainEvents(): object[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
```

### Value Object

```typescript
// src/orders/domain/money.value-object.ts
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
    if (amount < 0) throw new Error('Amount must be non-negative');
    if (!currency || currency.length !== 3) throw new Error('Invalid currency code');
    return new Money(amount, currency.toUpperCase());
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return Money.create(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### Domain Events via EventEmitter2

```typescript
// src/orders/domain/events/order-created.event.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

// src/notifications/application/order-created.handler.ts
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { OrderCreatedEvent } from '../../orders/domain/events/order-created.event';

@Injectable()
export class OrderCreatedHandler {
  @OnEvent(OrderCreatedEvent.name, { async: true })
  async handle(event: OrderCreatedEvent): Promise<void> {
    // send confirmation email, update read model, etc.
  }
}

// src/orders/application/create-order.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderRepository } from '../domain/order.repository';
import { Order } from '../domain/order';

@Injectable()
export class CreateOrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(customerId: string, items: OrderItem[]): Promise<string> {
    const order = Order.create(customerId, items);
    await this.orderRepository.save(order);

    const events = order.pullDomainEvents();
    for (const event of events) {
      await this.eventEmitter.emitAsync(event.constructor.name, event);
    }

    return order.id;
  }
}
```

### Repository Interface in Domain, Implementation in Infrastructure

```typescript
// src/orders/domain/order.repository.ts
import { Order } from './order';

export abstract class OrderRepository {
  abstract findById(id: string): Promise<Order | null>;
  abstract save(order: Order): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

// src/orders/infrastructure/typeorm-order.repository.ts
@Injectable()
export class TypeOrmOrderRepository extends OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
    private readonly mapper: OrderMapper,
  ) { super(); }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repo.findOne({ where: { id }, relations: ['items'] });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(order: Order): Promise<void> {
    await this.repo.save(this.mapper.toEntity(order));
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

// orders.module.ts — bind interface to implementation
@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    OrderMapper,
    CreateOrderService,
  ],
  exports: [CreateOrderService],
})
export class OrdersModule {}
```

### DDD Folder Structure

```
src/
  orders/
    domain/
      order.ts
      order-item.value-object.ts
      money.value-object.ts
      order.repository.ts        # abstract interface only
      events/
        order-created.event.ts
    application/
      create-order.service.ts
      cancel-order.service.ts
      dtos/
        create-order.dto.ts
    infrastructure/
      typeorm-order.repository.ts
      order.entity.ts
      order.mapper.ts
    presentation/
      orders.controller.ts
    orders.module.ts
```

## Anti-patterns

### Anemic Domain Model

```typescript
// BAD — Order is just a data bag; logic scattered in services
export class Order {
  id: string;
  status: string;
  items: OrderItem[];
}

@Injectable()
export class OrderService {
  confirm(order: Order): void {
    if (order.status !== 'pending') throw new Error('...');
    order.status = 'confirmed';
  }
}

// GOOD — aggregate enforces its own invariants
export class Order {
  confirm(): void {
    if (this._status !== 'pending') throw new Error('...');
    this._status = 'confirmed';
  }
}
```

### Business Logic in Controllers

```typescript
// BAD
@Post()
async create(@Body() dto: CreateOrderDto) {
  if (dto.items.length === 0) throw new BadRequestException('No items');
  const total = dto.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (total > 10000) throw new BadRequestException('Order too large');
  return this.repo.save({ ...dto, total });
}

// GOOD — controller delegates; domain enforces
@Post()
async create(@Body() dto: CreateOrderDto) {
  const id = await this.createOrderService.execute(dto.customerId, dto.items);
  return { id };
}
```

### TypeORM Entities Exposed Directly to Controllers

```typescript
// BAD — leaks DB schema, breaks encapsulation
@Get(':id')
findOne(@Param('id') id: string): Promise<OrderEntity> {
  return this.repo.findOne({ where: { id } });
}

// GOOD — map to response DTO
@Get(':id')
async findOne(@Param('id') id: string): Promise<OrderResponseDto> {
  const order = await this.findOrderService.execute(id);
  return OrderResponseDto.fromDomain(order);
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Simple CRUD, no business rules | Feature Modules + thin service, skip full DDD |
| Multiple invariants on one entity | Aggregate root with private constructor |
| Shared concept across modules | Value object (Money, Email, Address) |
| Side effect after state change | Domain event + @OnEvent handler |
| Swapping ORM later is a concern | Repository interface in domain layer |
| Complex reads (dashboards, reports) | Skip repository, query DB directly in application layer |
| Cross-aggregate coordination | Application service orchestrates both aggregates |
