---
name: validation
description: >
  Input validation with class-validator and class-transformer: DTO patterns, nested
  object validation, custom validators, @ValidateIf, @Transform, and @Type decorators.
  Load when writing DTOs, validating request bodies, query params, or nested objects.
  Trigger keywords: DTO, class-validator, class-transformer, @IsString, @IsEmail,
  @ValidateNested, @Type, @Transform, nested validation, custom validator, @IsOptional.
---

## Core Principles

1. **Every request body has a dedicated DTO class.** No `any`, no plain `object`.
   Rationale: DTOs are the contract between HTTP and your service layer — they document
   expected input and enforce validation in one place.

2. **`@Type()` is required on nested object properties.** Without it, class-transformer
   does not instantiate the nested class and class-validator silently skips nested
   validation. Rationale: this is the most common validation bug in NestJS codebases.

3. **`@Transform()` for normalization, not validation.** Trim strings, lowercase emails,
   parse comma-separated values — before validation runs. Rationale: validators should
   test normalized input, not raw client strings.

4. **Separate Create and Update DTOs.** `UpdateOrderDto` extends `PartialType(CreateOrderDto)`.
   Rationale: creation usually requires all fields; updates typically require at least
   one field. `PartialType` makes all fields optional without duplication.

5. **`@ValidateIf()` for conditional validation.** When a field is only required given
   another field's value. Rationale: `@IsOptional()` skips validation entirely when
   undefined; `@ValidateIf()` applies rules conditionally.

## Patterns

### Create and Update DTOs

```typescript
// orders/dto/create-order.dto.ts
import { IsString, IsUUID, IsInt, IsArray, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsUUID()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto) // required for nested validation
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
```

```typescript
// orders/dto/update-order.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

### Pagination DTO with @Transform

```typescript
// common/dto/pagination.dto.ts
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
```

### @Transform for string normalization

```typescript
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @MinLength(2)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;
}
```

### Custom validator constraint

```typescript
// common/validators/is-future-date.validator.ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    return value instanceof Date && value > new Date();
  }

  defaultMessage(_args: ValidationArguments): string {
    return '$property must be a future date';
  }
}

export function IsFutureDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

// Usage in DTO:
export class ScheduleDto {
  @Type(() => Date)
  @IsFutureDate()
  scheduledAt: Date;
}
```

### @ValidateIf for conditional validation

```typescript
export class PaymentDto {
  @IsString()
  method: 'card' | 'bank_transfer';

  @ValidateIf(o => o.method === 'card')
  @IsString()
  @Matches(/^\d{16}$/)
  cardNumber?: string;

  @ValidateIf(o => o.method === 'bank_transfer')
  @IsString()
  @Matches(/^\d{8,11}$/)
  accountNumber?: string;
}
```

### Async custom validator (DB uniqueness check)

```typescript
// common/validators/is-unique-email.validator.ts
import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { UsersRepository } from '../../users/repositories/users.repository';

@Injectable()
@ValidatorConstraint({ name: 'isUniqueEmail', async: true })
export class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
  constructor(private readonly usersRepo: UsersRepository) {}

  async validate(email: string): Promise<boolean> {
    const user = await this.usersRepo.findByEmail(email);
    return user === null;
  }

  defaultMessage(): string {
    return 'Email $value is already in use';
  }
}
// Register as a provider in the module and use useContainer(app.select(AppModule), ...) in main.ts
```

## Anti-patterns

### Manual validation in controller

```typescript
// BAD — brittle, not reusable, not documented as types
@Post()
create(@Body() body: any) {
  if (!body.email || !body.email.includes('@')) throw new BadRequestException('Invalid email');
  return this.service.create(body);
}

// GOOD — DTO + ValidationPipe handles it declaratively
export class CreateUserDto {
  @IsEmail()
  email: string;
}

@Post()
create(@Body() dto: CreateUserDto) {
  return this.service.create(dto);
}
```

### Missing @Type() on nested objects

```typescript
// BAD — nested validation silently skipped; items is a plain object, not OrderItemDto
export class CreateOrderDto {
  @ValidateNested({ each: true })
  // @Type() missing — class-transformer won't instantiate OrderItemDto
  items: OrderItemDto[];
}

// GOOD
export class CreateOrderDto {
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto) // required
  items: OrderItemDto[];
}
```

### Reusing CreateDto for Updates without PartialType

```typescript
// BAD — caller must always send all fields even for partial updates
export class UpdateOrderDto {
  @IsUUID()
  customerId: string; // required even for price-only updates
}

// GOOD
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

### `any` typed request body

```typescript
// BAD — no validation, no type safety in service
@Post()
create(@Body() body: any) { ... }

// GOOD
@Post()
create(@Body() dto: CreateOrderDto) { ... }
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Request body validation | DTO class + class-validator decorators |
| Optional fields in update | `PartialType(CreateDto)` |
| Nested object validation | `@ValidateNested` + `@Type(() => NestedDto)` |
| String normalization (trim, lowercase) | `@Transform()` in DTO |
| Conditional field requirement | `@ValidateIf(condition)` |
| Custom business rule validation | `@ValidatorConstraint` async validator |
| Query param validation | `PaginationDto` class with `@IsOptional` + `@Transform` |
| Enum validation | `@IsEnum(MyEnum)` with the actual enum |
