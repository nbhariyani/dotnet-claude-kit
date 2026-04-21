---
name: pipes
description: >
  NestJS Pipes: PipeTransform, ValidationPipe, ParseUUIDPipe, ParseIntPipe, custom
  pipes, global vs route-level. Load when setting up input validation, type coercion,
  or custom parsing for route params and request bodies.
  Trigger keywords: pipe, ValidationPipe, ParseUUIDPipe, ParseIntPipe, PipeTransform,
  whitelist, transform, validate, input, DTO validation, custom pipe.
---

## Core Principles

1. **`ValidationPipe` globally with `whitelist: true` is mandatory.** Register in
   `main.ts` before `app.listen()`. Rationale: without it, extra properties sent by
   clients silently reach services and can cause unintended data mutations.

2. **`ParseUUIDPipe` on every `:id` param.** Rationale: an invalid UUID reaching the
   database causes a cryptic query error; ParseUUIDPipe returns a clean 400 immediately.

3. **`transform: true` enables automatic type coercion.** Query string params arrive
   as strings; `transform: true` converts them to the declared TS type (number, boolean).
   Rationale: without it, `@Query('limit') limit: number` receives the string `"10"`.

4. **Custom pipes for domain-specific coercion.** Parsing enums, trimming strings,
   normalizing phone numbers — these belong in pipes, not in service methods.
   Rationale: keeps service input assumptions clean and reusable across endpoints.

5. **`forbidNonWhitelisted: true` alongside `whitelist: true`.** Rationale:
   `whitelist` strips unknown props silently; `forbidNonWhitelisted` rejects the
   request with a 400 so clients know they sent invalid data.

## Patterns

### Global ValidationPipe in main.ts

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties
      forbidNonWhitelisted: true, // reject requests with unknown properties
      transform: true,           // auto-coerce to declared TS types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(3000);
}

bootstrap();
```

### ParseUUIDPipe on :id params

```typescript
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findById(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.delete(id);
  }
}
```

### ParseIntPipe with custom error message

```typescript
import { ParseIntPipe, HttpStatus } from '@nestjs/common';

@Get()
findAll(
  @Query('page', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }))
  page: number,
  @Query('limit', new ParseIntPipe({ optional: true }))
  limit?: number,
) {
  return this.service.findAll({ page, limit: limit ?? 20 });
}
```

### Custom enum pipe

```typescript
// common/pipes/parse-order-status.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';
const VALID_STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'cancelled'];

@Injectable()
export class ParseOrderStatusPipe implements PipeTransform<string, OrderStatus> {
  transform(value: string): OrderStatus {
    const status = value.toLowerCase() as OrderStatus;
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }
    return status;
  }
}

// Usage:
@Get()
findByStatus(@Query('status', ParseOrderStatusPipe) status: OrderStatus) {
  return this.service.findByStatus(status);
}
```

### File upload validation pipe

```typescript
// common/pipes/file-validation.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

interface FileValidationOptions {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) throw new BadRequestException('File is required');
    if (file.size > this.options.maxSizeBytes) {
      throw new BadRequestException(
        `File exceeds max size of ${this.options.maxSizeBytes / 1024 / 1024}MB`,
      );
    }
    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }
    return file;
  }
}

// Usage:
@Post('avatar')
@UseInterceptors(FileInterceptor('file'))
uploadAvatar(
  @UploadedFile(new FileValidationPipe({ maxSizeBytes: 5_000_000, allowedMimeTypes: ['image/jpeg', 'image/png'] }))
  file: Express.Multer.File,
) { ... }
```

## Anti-patterns

### Manual validation in controller

```typescript
// BAD — duplicated validation, not reusable, bypasses class-validator
@Post()
create(@Body() body: any) {
  if (!body.customerId) throw new BadRequestException('customerId required');
  if (!body.items?.length) throw new BadRequestException('items required');
  return this.service.create(body);
}

// GOOD — ValidationPipe + DTO handles it
@Post()
create(@Body() dto: CreateOrderDto) {
  return this.service.create(dto);
}
```

### Missing whitelist:true allows extra properties through

```typescript
// BAD — client sends { price: 0 } which reaches service silently
new ValidationPipe() // no whitelist

// GOOD — strips unknown properties before service sees them
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
```

### Missing transform:true with typed query params

```typescript
// BAD — limit is the string "10", not number 10
@Get()
findAll(@Query('limit') limit: number) {
  return this.service.findAll(limit); // limit + 1 = "101" not 11
}

// GOOD — transform:true coerces "10" → 10
// (with transform: true in global ValidationPipe)
@Get()
findAll(@Query('limit') limit: number) {
  return this.service.findAll(limit); // correctly number 10
}
```

### @UsePipes per-route instead of global

```typescript
// BAD — easy to forget on new routes
@Post()
@UsePipes(new ValidationPipe({ whitelist: true }))
create(@Body() dto: CreateOrderDto) { ... }

// GOOD — global pipe in main.ts, no per-route decoration needed
app.useGlobalPipes(new ValidationPipe({ whitelist: true, ... }));
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Validate all incoming DTOs | Global `ValidationPipe` in `main.ts` |
| UUID route param | `@Param('id', ParseUUIDPipe)` |
| Numeric query param | `@Query('page', ParseIntPipe)` |
| String enum query param | Custom `PipeTransform` |
| File upload validation | Custom `PipeTransform` with `@UploadedFile()` |
| Strip unknown properties | `whitelist: true` in `ValidationPipe` |
| Reject requests with extra props | `forbidNonWhitelisted: true` |
| Auto-convert string → number in query | `transform: true` in `ValidationPipe` |
