---
name: docker
description: >
  Dockerizing NestJS applications. Load this skill when writing a Dockerfile,
  containerizing a NestJS app, building multi-stage Docker images, configuring
  docker-compose with postgres and redis, or setting up .dockerignore.
---

## Core Principles

1. **Three-stage Dockerfile: deps → build → production.** The production image must
   not contain devDependencies, build tools, or source files. A well-structured
   multi-stage build cuts image size by 60–80%.

2. **Never run as root.** Use `USER node` (built into the official node images) in
   the production stage. Root containers are a security liability in any environment.

3. **HEALTHCHECK in every production image.** Kubernetes and Docker Compose rely on
   health checks to know when a container is ready and when to restart it.

4. **.dockerignore is mandatory.** Without it, `node_modules`, `.git`, and local
   `.env` files are sent to the build context, slowing builds and risking secret leaks.

5. **Pin base image minor versions.** `node:22-alpine` is stable; `node:alpine` is
   a floating tag that can change and break builds silently.

## Patterns

### Three-Stage Dockerfile

```dockerfile
# ---- Stage 1: install all dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- Stage 2: build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: production image ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies in the final image
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Drop root privileges
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main"]
```

### .dockerignore

```
node_modules
dist
.git
.gitignore
.env
.env.*
!.env.example
*.md
coverage
.nyc_output
.vscode
.idea
npm-debug.log*
```

### docker-compose.yml (development)

```yaml
version: '3.9'

services:
  api:
    build:
      context: .
      target: build          # use build stage in dev (has source maps, devDeps)
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://dev:dev@postgres:5432/appdb
      REDIS_HOST: redis
      REDIS_PORT: 6379
    volumes:
      - .:/app
      - /app/node_modules    # prevent host node_modules from overwriting container
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run start:dev

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: appdb
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev -d appdb']
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

### Build and Run Locally

```bash
# Build production image
docker build --target production -t my-api:local .

# Run production image with env file
docker run --env-file .env -p 3000:3000 my-api:local

# Bring up full stack (dev)
docker compose up --build
```

## Anti-patterns

### Single-Stage Dockerfile with devDependencies

```dockerfile
# BAD — image includes typescript, jest, etc.; 3-4x larger than necessary
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/main"]

# GOOD — see three-stage pattern above
```

### Running as Root

```dockerfile
# BAD — container runs as root by default
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
CMD ["node", "dist/main"]

# GOOD — drop privileges before CMD
USER node
CMD ["node", "dist/main"]
```

### Missing .dockerignore

```dockerfile
# BAD — without .dockerignore, COPY . . sends node_modules (500 MB+) to daemon
COPY . .

# GOOD — add .dockerignore (see above), then COPY . . is safe
```

### Hardcoded Secrets in Dockerfile

```dockerfile
# BAD — secret baked into image layer
ENV JWT_SECRET=my-super-secret

# GOOD — pass at runtime via --env-file or Kubernetes secret
docker run --env-file .env my-api:local
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Production image size matters | Three-stage build; `npm ci --omit=dev` in final stage |
| Development hot reload | `docker compose` with `volumes` mount + `start:dev` |
| CI build caching | `COPY package*.json ./` before `COPY . .` to cache npm layer |
| Health check endpoint | `GET /api/health` returns 200; see health-check skill |
| Multi-arch (arm64 + amd64) | Use `docker buildx`; see container-publish skill |
| Secrets injection | Runtime env vars (`--env-file`) or Kubernetes Secrets |
