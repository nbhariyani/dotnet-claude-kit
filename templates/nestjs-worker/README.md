# nestjs-worker Template

Drop-in Claude Code companion for NestJS background worker projects.

## When to Use

Use this template when:
- Building async job processors (email, reports, exports)
- Consuming messages from NATS, RabbitMQ, or Kafka via `@nestjs/microservices`
- Running scheduled/cron tasks via `@nestjs/schedule`
- Offloading CPU-intensive work from your API process

Use `nestjs-rest-api` if you primarily need HTTP endpoints.

## How to Use

```bash
nest new my-worker
cp CLAUDE.md my-worker/CLAUDE.md
cd my-worker
claude
```

## Included Skills

| Skill | Purpose |
|---|---|
| `modern-typescript` | TypeScript 5.x idioms |
| `messaging` | BullMQ, @nestjs/microservices |
| `dependency-injection` | Module wiring, providers |
| `configuration` | @nestjs/config, env validation |
| `pino-logging` | Structured logging with job context |

## Bootstrap Variants

| Variant | Use Case |
|---|---|
| `createApplicationContext` | BullMQ-only worker, no HTTP |
| `createMicroservice` | NATS / RabbitMQ / Kafka consumer |
| Hybrid | HTTP health check port + microservice consumer |

## Key Conventions

- **Throw errors from processors** to trigger BullMQ retry — don't swallow
- **Always log `jobId` and `queueName`** — required for traceability
- **Exponential backoff** on job retries — prevent thundering herd on failures
- **Health endpoint** even on workers — `@nestjs/terminus` on a secondary port

## Agents

| Agent | When to Use |
|---|---|
| `nestjs-architect` | Queue topology, worker architecture |
| `devops-engineer` | Dockerfile, Kubernetes deployment, CI |
