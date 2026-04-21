# NestJS Worker — Project Instructions

> Drop this file into your NestJS worker project root. Claude will follow these instructions automatically.

## Project Type

NestJS background worker. Processes BullMQ jobs, microservice messages, or scheduled tasks. No HTTP server. TypeScript strict mode.

## When to Use This Pattern

- Async job processing (email sending, report generation, data export)
- Message consumers (`@nestjs/microservices` — NATS, RabbitMQ, Kafka)
- Scheduled background tasks (cron jobs via `@nestjs/schedule`)
- CPU-intensive work offloaded from the API process

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11+ (no HTTP adapter) |
| Language | TypeScript 5.x, strict mode |
| Queue | `@nestjs/bullmq` + `bullmq` |
| Microservices | `@nestjs/microservices` (optional) |
| Scheduling | `@nestjs/schedule` (optional) |
| ORM | TypeORM + `@nestjs/typeorm` (if DB needed) |
| Config | `@nestjs/config` + Joi validation |
| Logging | `nestjs-pino` + `pino` |
| Health | `@nestjs/terminus` |
| Package manager | pnpm |

## Project Structure

```
src/
  app.module.ts                 ← imports worker modules
  main.ts                       ← no HTTP; microservice or hybrid bootstrap
  processors/
    email.processor.ts          ← @Processor('emails')
    report.processor.ts         ← @Processor('reports')
  schedulers/
    cleanup.scheduler.ts        ← @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  consumers/                    ← @nestjs/microservices consumers
    order-events.consumer.ts
  shared/
    email/
      email.module.ts
      email.service.ts
    database/
      database.module.ts
```

## Bootstrap Options

### BullMQ Worker (most common)

```typescript
// main.ts — no HTTP listener
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  await app.init();
  // Process stays alive — BullMQ workers are event-driven
}
bootstrap();
```

### Microservice Consumer

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.NATS,
    options: { servers: [config.getOrThrow('NATS_URL')] },
  });
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
}
bootstrap();
```

### Hybrid (HTTP health + worker)

```typescript
// main.ts — HTTP for health checks, microservice for events
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.connectMicroservice<MicroserviceOptions>({ transport: Transport.NATS, ... });
await app.startAllMicroservices();
await app.listen(3001); // health check port only
```

## BullMQ Processor Patterns

```typescript
@Processor('emails')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobDto>): Promise<void> {
    this.logger.log({ jobId: job.id, type: job.name }, 'Processing email job');

    switch (job.name) {
      case 'welcome':
        await this.emailService.sendWelcome(job.data);
        break;
      case 'order-confirmation':
        await this.emailService.sendOrderConfirmation(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }
}
```

## Scheduled Tasks

```typescript
@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(private readonly cleanupService: CleanupService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyCleanup(): Promise<void> {
    this.logger.log('Starting daily cleanup');
    await this.cleanupService.purgeExpiredSessions();
  }
}
```

## Error Handling in Workers

- **Throw errors to trigger BullMQ retry** — do not catch and swallow
- **Use `job.moveToFailed()` for unrecoverable errors** after max retries
- **Log job context** (jobId, queue, attempt) with every error

```typescript
async process(job: Job<EmailJobDto>): Promise<void> {
  try {
    await this.emailService.send(job.data);
  } catch (error) {
    this.logger.error({ jobId: job.id, attempt: job.attemptsMade, error }, 'Job failed');
    throw error; // rethrow — BullMQ will retry
  }
}
```

## Configuration

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.getOrThrow('REDIS_HOST'),
      port: config.getOrThrow<number>('REDIS_PORT'),
    },
  }),
  inject: [ConfigService],
}),

BullModule.registerQueue(
  { name: 'emails', defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } },
  { name: 'reports' },
),
```

## Health Check

Even workers should expose a health endpoint. Use hybrid bootstrap + `@nestjs/terminus`.

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
```

## Logging

- Use `nestjs-pino` — no `console.log`
- Always log `jobId` and `queueName` for traceability
- Never log PII (email addresses, tokens) at `info` level or above

## Testing

- **Unit test processors** with `createTestingModule` + mocked services
- **Integration test** queue behavior with `@testcontainers/redis` (real Redis)
- **E2E**: add a job via `Queue.add()`, wait, assert outcome in DB

```typescript
it('process_validEmailJob_sendsEmail', async () => {
  const job = createMock<Job<EmailJobDto>>({
    data: { to: 'test@example.com', subject: 'Hello' },
  });
  await processor.process(job);
  expect(emailService.send).toHaveBeenCalledWith(job.data);
});
```

## Skills to Load

- `modern-typescript`
- `messaging` — BullMQ processors, microservices
- `dependency-injection` — provider wiring
- `configuration` — `@nestjs/config`, env validation
- `pino-logging` — structured logging with job context

## Agents to Use

- `/nestjs-architect` — Worker architecture, queue design
- `/devops-engineer` — Dockerfile, CI/CD for worker deployment
