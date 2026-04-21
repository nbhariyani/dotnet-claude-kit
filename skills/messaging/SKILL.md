---
name: messaging
description: >
  Asynchronous messaging patterns for NestJS: BullMQ queues, EventEmitter2 in-process
  events, and NATS microservices. Load this skill when working with @nestjs/bullmq,
  background jobs, @Processor, job retry, EventEmitter2, @OnEvent, NATS, or
  @MessagePattern.
---

## Core Principles

1. **BullMQ for work that must survive a restart.** In-process EventEmitter2 events
   are lost if the process crashes between emit and handler execution. Use BullMQ
   for anything durable: email sending, payment processing, report generation.

2. **Always configure retry with exponential backoff.** A job with no retry
   configuration gets one attempt. A transient DB timeout will permanently lose the
   job. Set `attempts` and `backoff` on every queue.

3. **Rethrow errors in processors — never swallow them.** BullMQ marks a job as
   failed only when the processor throws. Swallowing errors silently discards jobs
   with no retry.

4. **EventEmitter2 for in-process pub/sub with no durability requirement.** Domain
   events that trigger cache invalidation, audit log updates, or notification emails
   within the same process are a good fit for EventEmitter2.

5. **NATS for inter-service messaging in a microservices architecture.** Use
   `@MessagePattern` for request-reply and `@EventPattern` for one-way broadcast.
   Each service is a separate NestJS microservice with its own transport.

## Patterns

### BullMQ: Queue Setup

```typescript
// src/app.module.ts
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
    }),
    EmailModule,
  ],
})
export class AppModule {}

// src/email/email.module.ts
import { BullModule } from '@nestjs/bullmq';

export const EMAIL_QUEUE = 'email';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
```

### BullMQ: Enqueue a Job

```typescript
// src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.module';

export interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<SendEmailJobData>,
  ) {}

  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    await this.emailQueue.add(
      'send-welcome',
      { to: email, subject: 'Welcome!', template: 'welcome', context: { userId } },
      { delay: 0, priority: 1 },
    );
  }
}
```

### BullMQ: Processor

```typescript
// src/email/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, SendEmailJobData } from './email.module';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<SendEmailJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);

    try {
      await this.sendEmail(job.data);
      this.logger.log(`Job ${job.id} completed`);
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${(err as Error).message}`);
      throw err;  // rethrow so BullMQ marks the job failed and schedules retry
    }
  }

  private async sendEmail(data: SendEmailJobData): Promise<void> {
    // call email provider SDK
  }
}
```

### EventEmitter2: In-Process Events

```typescript
// src/app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
  ],
})
export class AppModule {}

// Emitting from a service
@Injectable()
export class OrdersService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(dto);
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id));
    return order;
  }
}

// Handling with @OnEvent
@Injectable()
export class NotificationsService {
  @OnEvent('order.created', { async: true })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // send notification — fire-and-forget within same process
  }
}
```

### NATS Microservice

```typescript
// src/main.ts (order service — hybrid app)
const app = await NestFactory.create(AppModule);
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.NATS,
  options: {
    servers: [config.getOrThrow('NATS_URL')],
  },
});
await app.startAllMicroservices();
await app.listen(config.getOrThrow('PORT'));

// Handling a message pattern
@Controller()
export class OrdersMicroserviceController {
  @MessagePattern('order.getById')
  async getById(@Payload() data: { id: string }): Promise<OrderResponseDto> {
    return this.ordersService.findById(data.id);
  }

  @EventPattern('payment.completed')
  async onPaymentCompleted(@Payload() event: PaymentCompletedEvent): Promise<void> {
    await this.ordersService.confirmOrder(event.orderId);
  }
}
```

## Anti-patterns

### Swallowing Errors in Processors

```typescript
// BAD — job is marked complete even though it failed; no retry
async process(job: Job<SendEmailJobData>): Promise<void> {
  try {
    await this.sendEmail(job.data);
  } catch {
    this.logger.error('Email failed');
    // swallowed — BullMQ never retries
  }
}

// GOOD — rethrow so BullMQ handles retry
async process(job: Job): Promise<void> {
  try {
    await this.sendEmail(job.data);
  } catch (err) {
    this.logger.error(`Email failed: ${(err as Error).message}`);
    throw err;
  }
}
```

### No Retry Configuration

```typescript
// BAD — one attempt; transient error permanently loses the job
BullModule.registerQueue({ name: 'email' })

// GOOD — configure retries with backoff
BullModule.forRoot({
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
})
```

### EventEmitter2 for Durable Work

```typescript
// BAD — event is lost if process crashes between emit and handler
this.eventEmitter.emit('payment.charge', { amount: 99, token: 'tok_...' });

// GOOD — use BullMQ for work that must not be lost
await this.paymentQueue.add('charge', { amount: 99, token: 'tok_...' });
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Email / PDF / report generation | BullMQ with retry + exponential backoff |
| Cache invalidation after event | EventEmitter2 `@OnEvent` (in-process, fire-and-forget) |
| Domain events (audit log, notifications) | EventEmitter2 for simple cases; BullMQ if durability needed |
| Inter-service communication | NATS `@MessagePattern` (request-reply) |
| Broadcast to multiple services | NATS `@EventPattern` (pub/sub) |
| Scheduled/recurring jobs | `@nestjs/schedule` with `@Cron` |
| Rate-limited external API calls | BullMQ with `limiter` option on the queue |
