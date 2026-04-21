---
name: typeorm
description: >
  TypeORM patterns for NestJS applications. Covers entity definitions, repository
  injection, QueryBuilder, transactions, relations, migrations, and query
  optimization. The default ORM for NestJS projects in this kit.
  Load this skill when working with databases, entities, queries, migrations, or
  when the user mentions "TypeORM", "entity", "repository", "migration",
  "QueryBuilder", "relation", "N+1", "eager loading", "lazy loading",
  "DataSource", "findAndCount", "typeorm migration", or "database schema".
---

# TypeORM (NestJS)

## Core Principles

1. **TypeORM is the default ORM** — Deep NestJS integration via `@nestjs/typeorm`.
   Use Prisma as an alternative when you prefer schema-first or want better
   migration DX. See the `prisma` skill for that path.
2. **Inject Repository<Entity>, not DataSource** — Use `@InjectRepository(Entity)`
   for standard data access. Reserve `DataSource` for multi-entity transactions.
3. **Project queries — don't load full entities for list endpoints** — Use `.select()`
   or `findAndCount({ select: [...] })` to avoid loading unnecessary columns.
4. **`synchronize: false` in all environments except local dev** — Always generate,
   review, and apply migrations explicitly. Never use `synchronize: true` in staging
   or production.
5. **Migrations are code — always review before running** — Generated migrations may
   have destructive operations (DROP COLUMN). Review every generated file.

## Patterns

### Entity Definition

```typescript
// orders/entities/order.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, Index,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index(['customerId', 'status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  total: string; // decimal comes back as string from PostgreSQL

  @Column({ default: 'pending', length: 50 })
  status: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Module Registration (Async)

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.getOrThrow('DATABASE_URL'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: config.get('NODE_ENV') === 'development',
  }),
})

// orders/orders.module.ts — register entity for this feature
TypeOrmModule.forFeature([Order, OrderItem])
```

### Repository Injection and Queries

```typescript
// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async findPaginated(page: number, limit: number, status?: string) {
    const [items, total] = await this.orderRepo.findAndCount({
      select: ['id', 'customerId', 'total', 'status', 'createdAt'],
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findByCustomerWithItems(customerId: string): Promise<Order[]> {
    return this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.customerId = :customerId', { customerId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }
}
```

### Transactions with DataSource

```typescript
@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        customerId: dto.customerId,
        status: 'pending',
      });
      await manager.save(order);

      for (const item of dto.items) {
        await manager.decrement(
          Inventory,
          { productId: item.productId },
          'quantity',
          item.qty,
        );
      }

      return order;
    });
  }
}
```

### IEntityTypeConfiguration (Centralized Mapping)

```typescript
// orders/entities/order.entity-config.ts
import { EntitySchemaColumnOptions } from 'typeorm';
import { EntitySchema } from 'typeorm';

// Alternative: use separate config class for complex entities
@Injectable()
export class OrderEntityConfig implements EntityMetadataInterface {
  // Use @Column({ transformer: { to, from } }) for value objects
}

// Value object transformer example
@Column({
  type: 'jsonb',
  transformer: {
    to: (address: Address) => address,
    from: (raw: any) => new Address(raw.street, raw.city, raw.zip),
  },
})
shippingAddress: Address;
```

### Migration Workflow

```bash
# 1. Generate migration after entity changes
npx typeorm migration:generate src/migrations/AddOrderStatusIndex \
  -d src/data-source.ts

# 2. ALWAYS review the generated file before running
cat src/migrations/1234567890-AddOrderStatusIndex.ts

# 3. Apply to development database
npx typeorm migration:run -d src/data-source.ts

# 4. Revert last migration if needed
npx typeorm migration:revert -d src/data-source.ts
```

```typescript
// src/data-source.ts — required for CLI commands
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/src/migrations/*{.ts,.js}'],
});
```

## Anti-patterns

### Never Use synchronize: true in Production

```typescript
// BAD — drops and recreates tables on restart, destroys production data
TypeOrmModule.forRoot({ synchronize: true })

// GOOD — always false; use migrations
TypeOrmModule.forRoot({ synchronize: process.env.NODE_ENV === 'development' })
// Even better: always false everywhere, always use migrations
```

### Don't Load Full Entities for List Endpoints

```typescript
// BAD — loads all columns including large JSONB, blobs, relations
const orders = await this.orderRepo.find();

// GOOD — select only needed columns
const orders = await this.orderRepo.find({
  select: ['id', 'customerId', 'total', 'status', 'createdAt'],
});
```

### Don't Do N+1 Queries

```typescript
// BAD — one query per order to load items
const orders = await this.orderRepo.find();
for (const order of orders) {
  order.items = await this.itemRepo.find({ where: { orderId: order.id } });
}

// GOOD — one JOIN query
const orders = await this.orderRepo.find({ relations: { items: true } });
// Or QueryBuilder with leftJoinAndSelect
```

### Don't Use Raw Strings in Custom Queries

```typescript
// BAD — SQL injection risk
const orders = await this.orderRepo.query(
  `SELECT * FROM orders WHERE customer_id = '${customerId}'`
);

// GOOD — parameterized
const orders = await this.orderRepo.query(
  'SELECT * FROM orders WHERE customer_id = $1',
  [customerId]
);
// Better: use QueryBuilder
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Standard CRUD | `Repository<Entity>` with `find`, `findOne`, `save`, `delete` |
| Paginated list | `findAndCount({ skip, take, select })` |
| Complex joins / filters | `QueryBuilder` with `leftJoinAndSelect`, `where`, `orderBy` |
| Multi-entity transaction | `DataSource.transaction(manager => ...)` |
| Value object mapping | `@Column({ transformer: { to, from } })` |
| Schema change | `typeorm migration:generate` → review → `migration:run` |
| Prisma instead | Use when schema-first preferred or migration DX matters more |
| Bulk insert | `Repository.save([...])` or `QueryBuilder.insert().values([...])` |
