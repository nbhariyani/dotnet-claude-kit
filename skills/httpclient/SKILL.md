---
name: httpclient
description: >
  HTTP client with @nestjs/axios: HttpModule registration, HttpService injection,
  typed responses with firstValueFrom, request/response interceptors, retry with
  cockatiel, and timeout configuration. Load when making outbound HTTP calls to
  external APIs or internal services.
  Trigger keywords: HTTP client, HttpService, @nestjs/axios, HttpModule, axios,
  firstValueFrom, outbound HTTP, external API, retry, interceptor, axios interceptor.
---

## Core Principles

1. **Always use `@nestjs/axios` — never `new axios()` or `require('axios')` directly.**
   Rationale: `HttpModule` manages a shared Axios instance with configurable defaults,
   interceptors, and proper NestJS DI. Creating instances per call exhausts connections.

2. **`firstValueFrom()` converts the Observable to a Promise.** Rationale: Axios
   returns an `AxiosResponse` wrapped in an Observable; `firstValueFrom` unwraps it
   cleanly for `async/await` usage without subscribing manually.

3. **Wrap every `HttpService` call in a dedicated service method.** Never inject
   `HttpService` directly into controllers. Rationale: a dedicated service method
   centralizes error handling, retries, and type mapping for a specific downstream API.

4. **Type the response explicitly.** `firstValueFrom(this.http.get<MyType>(url))` gives
   `AxiosResponse<MyType>`. Rationale: untyped responses require casting at call sites,
   which spreads type assertions throughout the codebase.

5. **Add resilience via cockatiel for external calls.** Rationale: external services
   fail. Without retry and circuit-breaker, a flaky upstream makes your API flaky too.

## Patterns

### HttpModule.registerAsync with config

```typescript
// external-api/external-api.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExternalApiService } from './external-api.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow<string>('EXTERNAL_API_URL'),
        timeout: config.get<number>('HTTP_TIMEOUT_MS') ?? 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2024-01',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ExternalApiService],
  exports: [ExternalApiService],
})
export class ExternalApiModule {}
```

### HttpService with firstValueFrom and typed response

```typescript
// external-api/external-api.service.ts
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface ShippingRate {
  carrier: string;
  rateId: string;
  price: number;
  estimatedDays: number;
}

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);

  constructor(private readonly http: HttpService) {}

  async getShippingRates(params: {
    weight: number;
    destinationZip: string;
  }): Promise<ShippingRate[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<ShippingRate[]>('/shipping/rates', { params }),
      );
      return data;
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Shipping API error: ${error.response?.status} ${error.message}`,
        );
        throw new ServiceUnavailableException('Shipping service unavailable');
      }
      throw error;
    }
  }

  async createShipment(payload: {
    rateId: string;
    addressTo: Record<string, string>;
  }): Promise<{ trackingNumber: string }> {
    const { data } = await firstValueFrom(
      this.http.post<{ trackingNumber: string }>('/shipments', payload),
    );
    return data;
  }
}
```

### Axios request interceptor for auth headers

```typescript
// external-api/interceptors/auth.interceptor.ts
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiAuthInterceptor implements OnModuleInit {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.http.axiosRef.interceptors.request.use(requestConfig => {
      requestConfig.headers['Authorization'] =
        `Bearer ${this.config.getOrThrow('EXTERNAL_API_KEY')}`;
      return requestConfig;
    });
  }
}
```

### Retry with cockatiel

```typescript
// external-api/external-api.service.ts (with retry)
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Policy, handleAll, retry, ExponentialBackoff } from 'cockatiel';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ExternalApiService {
  private readonly retryPolicy = Policy.wrap(
    retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff() }),
  );

  constructor(private readonly http: HttpService) {}

  async getProduct(id: string): Promise<Product> {
    return this.retryPolicy.execute(async () => {
      const { data } = await firstValueFrom(
        this.http.get<Product>(`/products/${id}`),
      );
      return data;
    });
  }
}
```

### Response interceptor for logging

```typescript
onModuleInit(): void {
  this.http.axiosRef.interceptors.response.use(
    response => {
      this.logger.debug(
        `${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`,
      );
      return response;
    },
    (error: AxiosError) => {
      this.logger.error(
        `${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status ?? 'no-response'}`,
      );
      return Promise.reject(error);
    },
  );
}
```

## Anti-patterns

### Creating axios instance per call

```typescript
// BAD — new connection pool on every invocation
import axios from 'axios';

async getUser(id: string) {
  const { data } = await axios.get(`/users/${id}`); // raw axios, no DI
  return data;
}

// GOOD — inject HttpService, single managed instance
constructor(private readonly http: HttpService) {}

async getUser(id: string) {
  const { data } = await firstValueFrom(this.http.get<User>(`/users/${id}`));
  return data;
}
```

### HttpService in a controller

```typescript
// BAD — HTTP client logic in controller, no reuse, no error handling layer
@Controller('shipping')
export class ShippingController {
  constructor(private readonly http: HttpService) {}

  @Get('rates')
  async getRates() {
    return firstValueFrom(this.http.get('https://api.shipper.io/rates'));
  }
}

// GOOD — dedicated service wraps HttpService
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingApiService: ShippingApiService) {}

  @Get('rates')
  getRates(@Query() query: RatesQueryDto) {
    return this.shippingApiService.getRates(query);
  }
}
```

### Ignoring Axios errors

```typescript
// BAD — network errors become unhandled promise rejections
const { data } = await firstValueFrom(this.http.get('/orders'));

// GOOD — catch, log, and translate to NestJS exception
try {
  const { data } = await firstValueFrom(this.http.get('/orders'));
  return data;
} catch (error: unknown) {
  if (error instanceof AxiosError) {
    throw new ServiceUnavailableException('Upstream service error');
  }
  throw error;
}
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Call external REST API | `HttpModule.registerAsync` + `HttpService` |
| Add auth header to all requests | Axios request interceptor in `OnModuleInit` |
| Retry transient failures | `cockatiel` Policy with `ExponentialBackoff` |
| Circuit break failing upstream | `cockatiel` `circuitBreaker` policy |
| Log all outbound calls | Axios response interceptor |
| Timeout per request | `timeout` in `HttpModule.registerAsync` config |
| Multiple upstream APIs | One `HttpModule` registration per API module |
