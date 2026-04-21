---
description: >
  Database migration workflow for NestJS projects using TypeORM or Prisma. Detects
  which ORM is in use and runs the correct migration commands. Validates safety before
  running in production. Triggers on: "run migrations", "create migration",
  "migrate database", "apply schema changes".
---

# /migrate

## What

Detects whether the project uses TypeORM or Prisma, then runs the correct migration
commands. Includes a pre-run safety checklist and post-run verification to prevent
data loss from unreviewed migrations.

## When

- "run migrations"
- "create a migration"
- "migrate the database"
- "apply schema changes"
- After modifying entities or the Prisma schema

## How

### Step 1: Detect ORM

Check `package.json` dependencies:
- `typeorm` present → TypeORM workflow
- `@prisma/client` present → Prisma workflow
- Both present → ask which to use

### Step 2: Generate Migration

**TypeORM:**

```bash
npx typeorm migration:generate -d src/data-source.ts src/migrations/<DescriptiveName>
```

**Prisma:**

```bash
npx prisma migrate dev --name <descriptive-name>
```

### Step 3: Review Generated Migration

**Always review generated SQL before running.** For TypeORM, open the generated
migration file and inspect the `up()` method. For Prisma, review the `.sql` file
in `prisma/migrations/`.

Check for:
- Destructive operations (`DROP COLUMN`, `DROP TABLE`) — are these intentional?
- Large table rewrites — will this lock the table in production?
- Missing data backfill for new NOT NULL columns

### Step 4: Pre-Run Checklist

Before running against staging or production:

- [ ] Database backup exists and is recent
- [ ] Rollback plan is documented (the `down()` method or reverting the deploy)
- [ ] Migration is zero-downtime compatible (no table locks blocking the running app)
- [ ] Migration has been tested against a production-equivalent data set

### Step 5: Run Migration

**TypeORM:**

```bash
# Development
npx typeorm migration:run -d src/data-source.ts

# Production (via CI/CD)
node dist/data-source.js migration:run
```

**Prisma:**

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Step 6: Post-Run Verification

Spot-check key tables: row counts reasonable, new columns populated, constraints active.

## Example — TypeORM vs Prisma Side by Side

| Step | TypeORM | Prisma |
|---|---|---|
| Generate | `migration:generate -d src/data-source.ts src/migrations/AddOrderStatus` | `prisma migrate dev --name add-order-status` |
| Review | Open `src/migrations/...AddOrderStatus.ts` | Open `prisma/migrations/.../migration.sql` |
| Run (dev) | `migration:run -d src/data-source.ts` | `prisma migrate dev` |
| Run (prod) | `migration:run` via compiled JS | `prisma migrate deploy` |
| Rollback | `migration:revert -d src/data-source.ts` | Revert deploy, restore backup |

## Related

- `/verify` -- Confirm build passes after schema change
- `/build-fix` -- Fix TypeScript errors from entity changes
