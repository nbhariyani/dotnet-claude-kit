---
name: controllers
description: >
  NestJS controller patterns for REST APIs. Covers routing decorators, parameter
  extraction, DTO validation, response shaping, route prefixing, versioning, and
  file uploads.
  Load this skill when creating endpoints, defining routes, handling HTTP requests,
  or when the user mentions "controller", "@Controller", "@Get", "@Post", "@Put",
  "@Delete", "@Patch", "@Body", "@Param", "@Query", "route", "endpoint",
  "ParseUUIDPipe", "HttpCode", "Header", or "response shape".
---

# Controllers (NestJS)

## Core Principles

1. **Controllers are thin orchestrators** — They extract input, call the service,
   and return the result. No business logic, no database calls, no try-catch.
2. **DTOs with class-validator on every @Body()** — Never accept raw request bodies.
   Every `@Body()` parameter must have a typed DTO class with `@IsString()`, etc.
3. **Use built-in pipes for route params** — `ParseUUIDPipe`, `ParseIntPipe`,
   `ParseBoolPipe` prevent raw string params reaching services.
4. **@HttpCode for non-200 success responses** — Explicitly declare 201 for creates,
   204 for deletes. Don't rely on NestJS defaults.
5. **Return plain objects, not entity classes** — Map entities to response DTOs
   before returning. Never expose database entity structure directly to clients.

## Patterns

### Standard CRUD Controller

```typescript
// orders/orders.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll(@Query() query: OrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.remove(id);
  }
}
```

### DTO with class-validator

```typescript
// orders/dto/create-order.dto.ts
import { IsString, IsUUID, IsArray, ArrayMinSize, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
```

### Query DTO with Pagination

```typescript
// common/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

// orders/dto/orders-query.dto.ts — extend for resource-specific filters
export class OrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
```

### Response DTO Mapping (never expose entity)

```typescript
// orders/dto/order-response.dto.ts
export class OrderResponseDto {
  id: string;
  customerId: string;
  total: number;
  status: string;
  createdAt: string;

  static from(order: Order): OrderResponseDto {
    return {
      id: order.id,
      customerId: order.customerId,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    };
  }
}

// In controller
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
  const order = await this.ordersService.findById(id);
  return OrderResponseDto.from(order);
}
```

### CurrentUser in Controller

```typescript
@Get('my-orders')
getMyOrders(@CurrentUser() user: JwtPayload) {
  return this.ordersService.findByCustomer(user.userId);
}
```

### Custom Route Param Pipe

```typescript
// common/pipes/parse-positive-int.pipe.ts
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException(`${value} is not a positive integer`);
    }
    return parsed;
  }
}

// Usage
@Get(':page')
getPage(@Param('page', ParsePositiveIntPipe) page: number) { ... }
```

## Anti-patterns

### Don't Put Business Logic in Controllers

```typescript
// BAD — validation, calculation, and DB access in controller
@Post()
async create(@Body() dto: CreateOrderDto, @Request() req) {
  if (dto.items.length === 0) throw new BadRequestException('Empty cart');
  const total = dto.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order = await this.repo.save({ ...dto, total, userId: req.user.id });
  return order;
}

// GOOD — delegate everything to service
@Post()
@HttpCode(HttpStatus.CREATED)
create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
  return this.ordersService.create(dto, user.userId);
}
```

### Don't Use Raw Strings for Route Params

```typescript
// BAD — no validation, 'abc' reaches the database query
@Get(':id')
findOne(@Param('id') id: string) { return this.service.findById(id); }

// GOOD — ParseUUIDPipe rejects non-UUID strings with 400
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findById(id); }
```

### Don't Return Entity Classes Directly

```typescript
// BAD — exposes passwordHash, internal fields, circular refs
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id); // returns User entity with passwordHash
}

// GOOD — map to response DTO
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
  return UserResponseDto.from(await this.service.findById(id));
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Create resource | `@Post()` + `@HttpCode(201)` + `@Body() dto: CreateXDto` |
| Get paginated list | `@Get()` + `@Query() query: XQueryDto extends PaginationDto` |
| Get by ID | `@Get(':id')` + `@Param('id', ParseUUIDPipe)` |
| Update | `@Patch(':id')` + `@Body() dto: UpdateXDto` (PartialType) |
| Delete | `@Delete(':id')` + `@HttpCode(204)` |
| Current user context | `@CurrentUser()` custom decorator |
| File upload | `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile()` |
| Request scoping | Controller prefix via `@Controller('v1/orders')` |
