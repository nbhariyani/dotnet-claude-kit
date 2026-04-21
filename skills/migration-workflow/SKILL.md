---
name: migration-workflow
description: >
  Database migration workflows for NestJS with TypeORM and Prisma. Load this skill
  when running migrations, generating schema changes, configuring TypeORM CLI,
  Prisma migrate, zero-downtime migrations, or expand-contract pattern.
---

## Core Principles

1. **Never use `synchronize: true` in production.** It auto-applies schema changes
   without review, can truncate data on column type changes, and gives no rollback
   path. Use it only in local development if at all.

2. **Migration generation is a starting point, not the final output.** Generated
   migrations must be reviewed before committing. Auto-generation misses data
   backfills, index strategy, and partial index conditions.

3. **Run migrations before deploying the new app version.** The old app must be
   able to run against the new schema (expand phase). If migrations run after
   deploy, there is a window where the new code hits the old schema.

4. **Use expand-contract for zero-downtime changes.** Dropping a column or renaming
   one is a breaking change. Use expand (add new) → migrate data → contract (remove
   old) across multiple deploys.

5. **Commit migration files to source control.** Migrations are part of the
   application history. They must be versioned, reviewed, and never mutated after
   being applied to any non-local environment.

## Patterns

### TypeORM: data-source.ts

```typescript
// src/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [__dirname + '/\*\*/\*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/\*{.ts,.js}'],
  synchronize: false,
});
```

### TypeORM: package.json Scripts

```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts",
    "migration:show": "typeorm-ts-node-commonjs migration:show -d src/data-source.ts"
  }
}
```

### TypeORM: Generate and Review a Migration

```bash
# Generate based on entity diff vs current schema
npm run migration:generate -- src/migrations/AddOrderStatus

# Review the generated file BEFORE committing
# TypeORM auto-generates: ALTER TABLE "orders" ADD "status" varchar
# You may need to add: UPDATE "orders" SET "status" = 'pending' WHERE status IS NULL
# And then: ALTER TABLE "orders" ALTER COLUMN "status" SET NOT NULL

# Apply to dev DB
npm run migration:run

# Revert last migration
npm run migration:revert
```

### TypeORM: Manual Migration with Data Backfill

```typescript
// src/migrations/1700000000000-AddOrderStatus.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderStatus1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add nullable column
    await queryRunner.query(`
      ALTER TABLE "orders" ADD "status" varchar
    `);

    // 2. Backfill existing rows
    await queryRunner.query(`
      UPDATE "orders" SET "status" = 'pending' WHERE "status" IS NULL
    `);

    // 3. Add NOT NULL constraint after backfill
    await queryRunner.query(`
      ALTER TABLE "orders" ALTER COLUMN "status" SET NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN "status"
    `);
  }
}
```

### Prisma: Migration Workflow

```bash
# Dev: generate migration and apply
npx prisma migrate dev --name add_order_status

# Check migration status
npx prisma migrate status

# Production: apply pending migrations (no schema push, no dev artifacts)
npx prisma migrate deploy

# Reset dev DB (destructive — never in production)
npx prisma migrate reset
```

### Prisma: Schema Change in schema.prisma

```prisma
model Order {
  id         String   @id @default(uuid())
  customerId String
  status     String   @default("pending")  // new field
  createdAt  DateTime @default(now())
}
```

### Zero-Downtime: Expand-Contract Pattern

```
Deploy 1 (Expand):
  - Add new column "customer_email" (nullable, no constraints)
  - Old app ignores it; new app writes to it

Deploy 2 (Backfill):
  - Run migration: UPDATE orders SET customer_email = customers.email FROM customers
  - Add NOT NULL constraint after backfill

Deploy 3 (Contract):
  - Remove old "email" column (no longer read by any deployed app version)
```

```typescript
// Deploy 1: expand migration
await queryRunner.query(`
  ALTER TABLE "orders" ADD "customer_email" varchar
`);

// Deploy 3: contract migration (after old app fully retired)
await queryRunner.query(`
  ALTER TABLE "orders" DROP COLUMN "email"
`);
```

## Anti-patterns

### synchronize: true in Production

```typescript
// BAD — TypeORM auto-applies schema diff on app start; can drop columns
TypeOrmModule.forRoot({
  synchronize: true,  // NEVER in production
})

// GOOD — always false in production; use migrations
TypeOrmModule.forRoot({
  synchronize: false,
  migrations: [...],
})
```

### Mutating Applied Migrations

```bash
# BAD — editing a migration that has already run on staging or production
# TypeORM tracks migration checksums; this will cause runtime errors or
# silent divergence between environments

# GOOD — generate a new migration for subsequent changes
npm run migration:generate -- src/migrations/FixOrderStatusConstraint
```

### Deploying App Before Migration Runs

```
# BAD order:
1. Deploy new app version (expects "status" column)
2. Run migration (adds "status" column)
# Window between 1 and 2: app crashes with "column does not exist"

# GOOD order:
1. Run migration (expand: add nullable "status" column)
2. Deploy new app version (reads and writes "status")
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| ORM choice | TypeORM (code-first) or Prisma (schema-first); both supported |
| Adding a new non-null column | Expand: add nullable → backfill → NOT NULL constraint |
| Renaming a column | Expand-contract over 2 deploys |
| Dropping a column | Remove all code references first, then drop in a migration |
| Production migration run | `prisma migrate deploy` or `typeorm migration:run` in CI/CD |
| Testing migration in CI | Run migration as a CI step before E2E tests |
