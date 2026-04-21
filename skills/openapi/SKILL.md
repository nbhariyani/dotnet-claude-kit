---
name: openapi
description: >
  OpenAPI/Swagger documentation for NestJS with @nestjs/swagger. Load this skill
  when configuring Swagger UI, using @ApiProperty, @ApiTags, @ApiBearerAuth,
  @ApiResponse, DocumentBuilder, generating swagger.json, or documenting DTOs.
---

## Core Principles

1. **DocumentBuilder setup happens before `app.listen()`.** Swagger scans routes
   at setup time. Calling `SwaggerModule.setup()` after `app.listen()` works in some
   versions but is unreliable and the wrong order. Always set up Swagger as the last
   step before `listen`.

2. **Every DTO field needs `@ApiProperty` with `example` and `description`.** An
   undocumented DTO field shows as `{}` in the spec. Tools that generate clients
   from the spec produce broken types. One annotation per field is non-negotiable.

3. **Every controller gets `@ApiTags`.** Without tags, all endpoints appear in a
   single unsorted group in Swagger UI. Tags group endpoints by resource and are
   essential for large APIs.

4. **`@ApiBearerAuth()` on every protected controller.** Without it, the "Authorize"
   button in Swagger UI does not apply to those routes and manual testing is tedious.

5. **Write `swagger.json` to disk in CI.** This enables spec diffing in PRs,
   generates client SDKs, and validates the spec in automated tests.

## Patterns

### DocumentBuilder and SwaggerModule Setup

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const spec = new DocumentBuilder()
    .setTitle(config.getOrThrow<string>('APP_NAME'))
    .setDescription('REST API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer(`http://localhost:${config.get('PORT', 3000)}`, 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, spec);

  // Write spec to disk for CI diffing and client generation
  if (config.get('NODE_ENV') !== 'production') {
    fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.getOrThrow<number>('PORT'));
}
```

### DTO with Full @ApiProperty Annotations

```typescript
// src/orders/dto/create-order.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ValidateNested, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'UUID of the product to order',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Number of units to order', example: 2, minimum: 1 })
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'UUID of the customer placing the order', example: 'c-123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ type: [CreateOrderItemDto], description: 'Line items for this order' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
```

### Response DTO with @ApiProperty

```typescript
// src/orders/dto/order-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class OrderResponseDto {
  @ApiProperty({ example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' })
  id: string;

  @ApiProperty({ example: 'c-123' })
  customerId: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'shipped', 'cancelled'], example: 'pending' })
  status: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}
```

### Controller with @ApiTags, @ApiBearerAuth, @ApiResponse

```typescript
// src/orders/orders.controller.ts
import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller({ version: '1', path: 'orders' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiCreatedResponse({ type: OrderResponseDto, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order UUID', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.ordersService.findById(id);
  }
}
```

### Writing swagger.json in CI

```yaml
# .github/workflows/ci.yml
- name: Generate Swagger spec
  run: |
    NODE_ENV=ci npm run build
    node -e "
      const app = require('./dist/main');
      // or use a dedicated script that calls createDocument without listen()
    "

# Better: dedicated script
- name: Write swagger.json
  run: npm run swagger:generate
```

```json
// package.json
{
  "scripts": {
    "swagger:generate": "ts-node src/generate-swagger.ts"
  }
}
```

## Anti-patterns

### @ApiProperty with type: Object

```typescript
// BAD — generates empty schema {}; clients have no type information
@ApiProperty({ type: Object })
metadata: Record<string, unknown>;

// GOOD — create a typed DTO or use a union
@ApiProperty({
  type: 'object',
  additionalProperties: { type: 'string' },
  example: { region: 'eu-west', priority: 'high' },
})
metadata: Record<string, string>;
```

### No @ApiTags

```typescript
// BAD — all endpoints appear in "default" group; unusable for large APIs
@Controller('orders')
export class OrdersController { ... }

// GOOD — grouped by resource
@ApiTags('orders')
@Controller('orders')
export class OrdersController { ... }
```

### SwaggerModule.setup After app.listen

```typescript
// BAD — may miss routes in some NestJS versions
await app.listen(3000);
SwaggerModule.setup('docs', app, document);

// GOOD — setup before listen
SwaggerModule.setup('docs', app, document);
await app.listen(3000);
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New project | DocumentBuilder + SwaggerModule.setup in main.ts |
| Protected endpoints | `@ApiBearerAuth('access-token')` on every secured controller |
| Update DTO | `PartialType(CreateDto)` inherits all `@ApiProperty` annotations |
| Enum field | `@ApiProperty({ enum: ['a', 'b'], example: 'a' })` |
| Array response | `@ApiResponse({ status: 200, type: [OrderResponseDto] })` |
| Generating client SDK | Write swagger.json in CI, feed to openapi-generator |
| Non-production Swagger UI | Gate on `NODE_ENV !== 'production'` |
