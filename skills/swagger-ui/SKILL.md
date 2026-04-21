---
name: swagger-ui
description: >
  OpenAPI/Swagger for NestJS with @nestjs/swagger: DocumentBuilder setup, @ApiProperty,
  @ApiTags, @ApiOperation, @ApiBearerAuth, @ApiResponse, and spec file generation.
  Load when adding API documentation, annotating DTOs, or setting up Swagger UI.
  Trigger keywords: Swagger, OpenAPI, @ApiProperty, @ApiTags, @ApiOperation,
  @ApiBearerAuth, @ApiResponse, DocumentBuilder, SwaggerModule, API docs, spec.
---

## Core Principles

1. **All DTO properties need `@ApiProperty()`.** Without it the Swagger schema is
   empty. Rationale: class-validator decorators do not generate OpenAPI schema;
   `@ApiProperty` is the only source of schema metadata.

2. **`@ApiTags` on every controller.** Rationale: without tags, all endpoints appear
   in a single uncategorized group — the Swagger UI becomes unusable on any real API.

3. **`@ApiBearerAuth()` on protected controllers or routes.** Rationale: without it,
   the Swagger UI "Authorize" button has no effect on protected endpoints during testing.

4. **Call `SwaggerModule.setup` before `app.listen()`.** Rationale: setup registers
   the `/api-docs` route — calling it after listen means the route is never registered.

5. **Generate and commit the OpenAPI spec file in CI.** Rationale: a committed
   `openapi.json` enables client SDK generation, contract testing, and API diff checks.

## Patterns

### Install

```bash
pnpm add @nestjs/swagger swagger-ui-express
```

### DocumentBuilder in main.ts

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { writeFileSync } from 'node:fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Orders API')
    .setDescription('Order management service')
    .setVersion('1.0')
    .addBearerAuth()           // enables the Authorize button for JWT
    .addServer('http://localhost:3000', 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Save spec for CI/client SDK generation
  if (process.env['NODE_ENV'] !== 'production') {
    writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  }

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(3000);
}

bootstrap();
```

### DTO with full @ApiProperty annotations

```typescript
// orders/dto/create-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ description: 'Product UUID', example: 'c3d4e5f6-...' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantity ordered', minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Customer UUID', example: 'a1b2c3d4-...' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Order line items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ description: 'Delivery notes', example: 'Leave at door' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

### Enum in Swagger

```typescript
import { ApiProperty } from '@nestjs/swagger';

export enum OrderStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  CANCELLED = 'cancelled',
}

export class OrderResponseDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', example: OrderStatus.PENDING })
  status: OrderStatus;
}
```

### Controller with full Swagger decorators

```typescript
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('orders')
@ApiBearerAuth()  // all endpoints in this controller require JWT
@Controller('orders')
export class OrdersController {
  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiCreatedResponse({ type: OrderResponseDto, description: 'Order created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    return this.ordersService.findById(id);
  }
}
```

### Paginated response schema

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedOrdersDto {
  @ApiProperty({ type: [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
```

### Bearer auth on a single route (not whole controller)

```typescript
@Get('admin/report')
@ApiBearerAuth()  // only this endpoint
@Roles('admin')
getReport(): Promise<ReportDto> { ... }
```

## Anti-patterns

### Missing @ApiProperty leaves schema blank

```typescript
// BAD — Swagger shows empty {} for this DTO
export class CreateOrderDto {
  @IsUUID()
  customerId: string; // no @ApiProperty
}

// GOOD
export class CreateOrderDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  customerId: string;
}
```

### @ApiProperty({ type: Object }) loses schema

```typescript
// BAD — renders as {} in Swagger, clients get no type info
@ApiProperty({ type: Object })
metadata: Record<string, unknown>;

// GOOD — use a typed DTO or accept the limitation explicitly
@ApiProperty({
  type: 'object',
  additionalProperties: true,
  description: 'Arbitrary metadata key/value pairs',
})
metadata: Record<string, unknown>;
```

### No @ApiTags — cluttered UI

```typescript
// BAD — all endpoints in default "default" group
@Controller('orders')
export class OrdersController { ... }

// GOOD
@ApiTags('orders')
@Controller('orders')
export class OrdersController { ... }
```

### SwaggerModule.setup after app.listen()

```typescript
// BAD — route never registered
await app.listen(3000);
SwaggerModule.setup('api-docs', app, document); // too late

// GOOD
SwaggerModule.setup('api-docs', app, document); // before listen
await app.listen(3000);
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Document a DTO property | `@ApiProperty({ description, example })` |
| Optional DTO property | `@ApiPropertyOptional()` |
| Enum property | `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })` |
| JWT-protected controller | `@ApiBearerAuth()` on the class |
| Group endpoints | `@ApiTags('resource-name')` on the controller |
| Document response schema | `@ApiOkResponse({ type: ResponseDto })` |
| Hide an endpoint from docs | `@ApiExcludeEndpoint()` |
| Generate spec file in CI | `writeFileSync('openapi.json', JSON.stringify(doc))` |
| Alternative UI (modern design) | Use `skills/scalar` instead of `swagger-ui-express` |
