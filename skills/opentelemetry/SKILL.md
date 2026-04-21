---
name: opentelemetry
description: >
  OpenTelemetry observability for NestJS: distributed tracing, metrics, and log
  correlation. Load this skill when working with opentelemetry, otel, tracing,
  spans, Jaeger, Prometheus, nestjs-otel, @Span decorator, or distributed tracing.
---

## Core Principles

1. **Initialize the OTel SDK before NestFactory.** `NodeSDK.start()` patches Node.js
   internals and third-party modules. If `NestFactory.create()` runs first, HTTP,
   database, and cache spans are never captured.

2. **Import tracing.ts as the very first line in main.ts.** This ensures the SDK is
   started even before NestJS bootstrap code executes.

3. **Correlate trace IDs with logs.** Every log line should include the active
   `traceId` and `spanId`. Without this correlation, traces and logs are disconnected
   and debugging across services is guesswork.

4. **Use @Span() for service-layer operations.** HTTP spans are auto-instrumented.
   Business operations (order creation, payment processing) need manual `@Span()`
   decoration to appear in traces.

5. **Export metrics to Prometheus, traces to OTLP.** Prometheus scrapes are the
   de facto standard for metrics in Kubernetes. OTLP is the standard protocol for
   traces; use it to send to Jaeger, Grafana Tempo, or any backend.

## Patterns

### tracing.ts — Must Be First

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env['APP_NAME'] ?? 'nestjs-app',
    [ATTR_SERVICE_VERSION]: process.env['npm_package_version'] ?? '0.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318/v1/traces',
  }),
  metricReader: new PrometheusExporter({ port: 9464 }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too verbose
    }),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

### main.ts — Import Tracing First

```typescript
// src/main.ts
import './tracing';  // MUST be the first import — before any NestJS import
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // ... rest of setup
  await app.listen(3000);
}

bootstrap();
```

### OpenTelemetryModule in AppModule (nestjs-otel)

```typescript
// src/app.module.ts
import { OpenTelemetryModule } from 'nestjs-otel';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      metrics: {
        hostMetrics: true,    // CPU, memory, event loop lag
        apiMetrics: {
          enable: true,       // HTTP request duration, count, status codes
          ignoreRoutes: ['/health', '/metrics'],
        },
      },
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### @Span Decorator on Service Methods

```typescript
// src/orders/orders.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Span, TraceService } from 'nestjs-otel';
import { SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class OrdersService {
  constructor(
    private readonly traceService: TraceService,
    private readonly orderRepository: OrderRepository,
  ) {}

  @Span('orders.create')
  async create(dto: CreateOrderDto): Promise<Order> {
    const span = this.traceService.getSpan();
    span?.setAttribute('order.customerId', dto.customerId);
    span?.setAttribute('order.itemCount', dto.items.length);

    try {
      const order = await this.orderRepository.save(dto);
      span?.setAttribute('order.id', order.id);
      return order;
    } catch (err) {
      span?.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    }
  }
}
```

### Log Correlation with Trace IDs (pino)

```typescript
// src/common/interceptors/trace-context.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { context, trace } from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class TraceContextInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(TraceContextInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const span = trace.getSpan(context.active());
    if (span) {
      const { traceId, spanId } = span.spanContext();
      this.logger.assign({ traceId, spanId });
    }
    return next.handle();
  }
}
```

## Anti-patterns

### Initializing OTel After NestFactory

```typescript
// BAD — HTTP, TypeORM, Redis spans are never captured
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NodeSDK } from '@opentelemetry/sdk-node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule); // too late
  const sdk = new NodeSDK({ ... });
  sdk.start();
}

// GOOD — see tracing.ts pattern above; import it first
import './tracing';
import { NestFactory } from '@nestjs/core';
```

### No Trace-Log Correlation

```typescript
// BAD — traces in Jaeger, logs in Loki, no way to find logs for a specific trace
this.logger.log('Order created');  // no traceId

// GOOD — inject traceId into every log line
this.logger.assign({ traceId, spanId });
this.logger.log('Order created');  // traceId: abc123 appears in Loki
```

### Tracing Only HTTP (Missing Business Spans)

```typescript
// BAD — trace shows HTTP call but nothing about what happened inside
// GOOD — @Span() on service methods gives visibility into business operations
@Span('payments.charge')
async charge(amount: number): Promise<ChargeResult> { ... }
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| New project setup | Add tracing.ts + `import './tracing'` before any other setup |
| HTTP metrics (duration, status) | `OpenTelemetryModule.forRoot` with `apiMetrics.enable: true` |
| Business operation visibility | `@Span('operation.name')` on service methods |
| Trace → log correlation | `TraceContextInterceptor` + pino `assign()` |
| Exporting traces | OTLPTraceExporter to Jaeger / Grafana Tempo |
| Exporting metrics | PrometheusExporter on port 9464; scrape via ServiceMonitor |
| K8s sidecar vs agent | OTEL Collector sidecar recommended for production |
