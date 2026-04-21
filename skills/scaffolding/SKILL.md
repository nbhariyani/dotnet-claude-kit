---
name: scaffolding
description: >
  NestJS code generation and scaffolding patterns. Load this skill when running
  nest generate commands, creating modules, services, controllers, guards, pipes,
  interceptors, or filters, and when registering new modules in AppModule.
---

## Core Principles

1. **`nest g resource` for full CRUD.** A single command generates the module,
   controller, service, DTOs, and entity skeleton. Use it as the starting point
   for any new resource.

2. **Register every new module in AppModule.imports.** The CLI generates files but
   does not always update AppModule automatically. Forgetting this causes DI failures
   with no useful error message.

3. **Name files exactly as NestJS expects.** The convention `<name>.<type>.ts`
   (`orders.service.ts`, `jwt.guard.ts`) is enforced by the linter and expected by
   the CLI. Deviating from it causes confusion and breaks IDE navigation.

4. **Create DTOs manually — never skip them.** Always create separate Create, Update,
   and Response DTOs. Using entity classes as DTOs leaks DB schema and bypasses
   validation.

5. **Flat generation, then move.** Generate at the `src/` level and let the CLI
   place files, or pass `--path` to target a feature folder. Avoid creating files
   manually without the CLI unless the CLI doesn't support the type.

## Patterns

### Full Resource Scaffold (CRUD)

```bash
# Generates module, controller, service, DTOs, entity skeleton
nest g resource orders

# Options prompted:
# - Transport: REST API
# - Generate CRUD entry points? Yes
```

This produces:
```
src/orders/
  orders.module.ts
  orders.controller.ts
  orders.controller.spec.ts
  orders.service.ts
  orders.service.spec.ts
  dto/
    create-order.dto.ts
    update-order.dto.ts
  entities/
    order.entity.ts
```

### Individual Generators

```bash
# Module
nest g module payments

# Controller (inside existing feature folder)
nest g controller payments --no-spec

# Service
nest g service payments

# Guard
nest g guard auth/jwt

# Interceptor
nest g interceptor common/logging

# Pipe
nest g pipe common/parse-uuid

# Filter
nest g filter common/all-exceptions

# Middleware
nest g middleware common/request-logger
```

### Manual DTO Creation

```typescript
// src/orders/dto/create-order.dto.ts
import { IsString, IsArray, IsNotEmpty, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'a3bb189e-8bf9-3888-9912-ace4e6543002' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'c-123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

// src/orders/dto/update-order.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

// src/orders/dto/order-response.dto.ts
export class OrderResponseDto {
  id: string;
  customerId: string;
  status: string;
  createdAt: Date;

  static from(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.customerId = order.customerId;
    dto.status = order.status;
    dto.createdAt = order.createdAt;
    return dto;
  }
}
```

### Registering a New Module in AppModule

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';  // <-- new

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OrdersModule,
    PaymentsModule,  // <-- register here
  ],
})
export class AppModule {}
```

### Generating into a Specific Path

```bash
# Generates guard at src/auth/guards/roles.guard.ts
nest g guard auth/guards/roles

# Generates filter at src/common/filters/http-exception.filter.ts
nest g filter common/filters/http-exception
```

## Anti-patterns

### Manual File Creation with Wrong Naming

```
# BAD — wrong suffix, breaks CLI and lint conventions
src/orders/OrderService.ts
src/orders/OrdersCtrl.ts

# GOOD — follow NestJS naming
src/orders/orders.service.ts
src/orders/orders.controller.ts
```

### Forgetting to Register the Module

```typescript
// BAD — PaymentsModule generated but never imported; injection fails silently
@Module({
  imports: [ConfigModule.forRoot(), OrdersModule],
  // PaymentsModule missing
})
export class AppModule {}

// GOOD
@Module({
  imports: [ConfigModule.forRoot(), OrdersModule, PaymentsModule],
})
export class AppModule {}
```

### Using Entity as DTO

```typescript
// BAD — leaks DB columns, bypasses validation, couples HTTP layer to schema
@Post()
create(@Body() order: OrderEntity) { ... }

// GOOD — dedicated DTO with class-validator decorators
@Post()
create(@Body() dto: CreateOrderDto) { ... }
```

### PartialType from Wrong Package

```typescript
// BAD — @nestjs/mapped-types does not emit Swagger metadata
import { PartialType } from '@nestjs/mapped-types';

// GOOD — use @nestjs/swagger version to preserve API docs
import { PartialType } from '@nestjs/swagger';
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New REST resource (full CRUD) | `nest g resource <name>` |
| Auth guard | `nest g guard auth/jwt` |
| Global logging interceptor | `nest g interceptor common/logging` |
| Request body validation | Create DTO with class-validator + ValidationPipe |
| Update DTO (subset of create) | `PartialType(CreateDto)` from `@nestjs/swagger` |
| Custom exception format | `nest g filter common/all-exceptions` |
| New shared pipe | `nest g pipe common/<name>` |
