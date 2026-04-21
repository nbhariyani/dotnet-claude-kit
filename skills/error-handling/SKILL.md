---
name: error-handling
description: >
  NestJS error handling using HttpException hierarchy, ExceptionFilters,
  global filter registration, and ProblemDetails-style responses (RFC 9457).
  Also covers the neverthrow Result pattern for typed domain failure paths.
  Load this skill when handling errors, writing exception filters, mapping errors
  to HTTP responses, or when the user mentions "exception", "HttpException",
  "ExceptionFilter", "NotFoundException", "error response", "ProblemDetails",
  "400", "404", "500", "try-catch", "Result pattern", or "neverthrow".
---

# Error Handling (NestJS)

## Core Principles

1. **HttpException subclasses for expected failures** — `NotFoundException`,
   `BadRequestException`, `ConflictException`, `UnauthorizedException`, and
   `ForbiddenException` map directly to the correct HTTP status. Use them.
2. **Always register a global ExceptionFilter** — Without one, unhandled exceptions
   leak stack traces and raw Error objects to clients in production.
3. **Return ProblemDetails format (RFC 9457)** — Consistent error shape across all
   endpoints; clients can handle errors generically.
4. **Controllers never catch service exceptions** — Services throw typed exceptions;
   the global filter handles everything else. No try-catch in controllers.
5. **neverthrow for explicit multi-path domain failures** — When a service has 3+
   named failure modes that callers must consciously handle, prefer `Result<T, E>`.

## Patterns

### Global Exception Filter (ProblemDetails)

```typescript
// common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error({ exception, path: req.url }, 'Unhandled exception');
    }

    res.status(status).json({
      type: `https://httpstatuses.com/${status}`,
      title: message,
      status,
      detail: exception instanceof HttpException
        ? JSON.stringify(exception.getResponse())
        : undefined,
      instance: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}

// main.ts — register globally
app.useGlobalFilters(new AllExceptionsFilter());
```

### Service Throws, Controller Does Nothing

```typescript
// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(@InjectRepository(Order) private readonly repo: Repository<Order>) {}

  async findById(id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.findById(id);
    if (order.status === 'shipped') {
      throw new ConflictException('Cannot cancel a shipped order');
    }
    order.status = 'cancelled';
    return this.repo.save(order);
  }
}

// orders/orders.controller.ts — no try/catch anywhere
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
```

### Validation Error Shape

```typescript
// main.ts — consistent 400 shape for class-validator errors
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const details = errors.map((e) => ({
        field: e.property,
        constraints: Object.values(e.constraints ?? {}),
      }));
      return new BadRequestException({ message: 'Validation failed', errors: details });
    },
  }),
);
```

### Result Pattern with neverthrow

Use when a service operation has multiple named, handleable failure modes.

```typescript
// npm install neverthrow
import { ok, err, Result } from 'neverthrow';

type PlaceOrderError = 'OUT_OF_STOCK' | 'CUSTOMER_SUSPENDED' | 'DUPLICATE_ORDER';

@Injectable()
export class OrdersService {
  async place(dto: CreateOrderDto): Promise<Result<Order, PlaceOrderError>> {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId } });
    if (customer?.status === 'suspended') return err('CUSTOMER_SUSPENDED');

    const stock = await this.inventoryRepo.findOne({ where: { productId: dto.productId } });
    if (!stock || stock.quantity < dto.qty) return err('OUT_OF_STOCK');

    return ok(await this.repo.save(this.repo.create(dto)));
  }
}

// Controller maps Result errors to HttpExceptions
@Post()
async create(@Body() dto: CreateOrderDto) {
  const result = await this.service.place(dto);
  if (result.isErr()) {
    const map: Record<PlaceOrderError, HttpException> = {
      OUT_OF_STOCK: new ConflictException('Product out of stock'),
      CUSTOMER_SUSPENDED: new ForbiddenException('Account suspended'),
      DUPLICATE_ORDER: new ConflictException('Order already exists'),
    };
    throw map[result.error];
  }
  return result.value;
}
```

### Domain-Specific Exception Classes

```typescript
// common/exceptions/order.exceptions.ts
export class OrderNotFoundException extends NotFoundException {
  constructor(id: string) { super(`Order ${id} not found`); }
}

export class OrderAlreadyShippedException extends ConflictException {
  constructor(id: string) { super(`Order ${id} is already shipped`); }
}
```

## Anti-patterns

### Don't Catch Exceptions in Controllers

```typescript
// BAD — doubles handling, hides context
@Get(':id')
async findOne(@Param('id') id: string) {
  try {
    return await this.service.findById(id);
  } catch {
    throw new NotFoundException('Not found');
  }
}

// GOOD — service throws, filter catches, controller does nothing
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}
```

### Don't Throw Generic Error from Services

```typescript
// BAD — becomes an unhandled 500
throw new Error('Order not found');

// GOOD — typed, correct HTTP status
throw new NotFoundException(`Order ${id} not found`);
```

### Don't Expose Internals in Error Responses

```typescript
// BAD — stack traces reach clients
response.status(500).json({ error: exception.stack });

// GOOD — ProblemDetails, no internal details
response.status(500).json({ type: '...', title: 'Internal server error', status: 500 });
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Resource not found | `throw new NotFoundException(...)` |
| Invalid input / validation | `ValidationPipe` + `BadRequestException` |
| Duplicate / state conflict | `throw new ConflictException(...)` |
| Not authenticated | `throw new UnauthorizedException(...)` |
| Not authorized | `throw new ForbiddenException(...)` |
| Multiple named domain failures | `neverthrow` Result pattern |
| Unexpected crash | Global `AllExceptionsFilter` logs + returns 500 |
| Semantic domain exception | Custom `HttpException` subclass |
