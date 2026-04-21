---
name: ci-cd
description: >
  GitHub Actions CI/CD pipelines for NestJS. Load this skill when setting up
  continuous integration, automated testing, GitHub Actions workflows, npm ci,
  deployment pipelines, or E2E tests in CI with a real database.
---

## Core Principles

1. **`npm ci` not `npm install` in CI.** `npm ci` installs from the lockfile exactly,
   is deterministic, and is faster because it skips the dependency resolution step.
   `npm install` can silently update the lockfile and produce different results
   between runs.

2. **Cache node_modules between runs.** Use `actions/cache` or the `cache` option on
   `actions/setup-node`. A cache hit reduces install time from 60s to 5s on most
   projects.

3. **Run a real database for E2E tests.** Use `services: postgres` in the workflow.
   SQLite in-memory behaves differently from PostgreSQL (no transactions, no JSON
   columns, no constraints). Tests that pass on SQLite may fail in production.

4. **Lint before test.** Linting is fast. Catching a lint error before waiting 2
   minutes for tests to run saves time. Order: lint → unit tests → build → E2E tests.

5. **CD triggers on tag push or workflow_dispatch.** Never auto-deploy on every push
   to main unless you are doing continuous deployment deliberately. Prefer tag-based
   releases for production.

## Patterns

### CI Workflow (Node.js + PostgreSQL)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test

      - name: Build
        run: npm run build

      - name: Run migrations
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
        run: npm run migration:run

      - name: E2E tests
        env:
          NODE_ENV: test
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: test-secret-at-least-32-characters-long
          PORT: 3000
        run: npm run test:e2e
```

### CD Workflow: Build and Push Container on Tag

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### package.json Scripts for CI

```json
{
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "test": "jest --passWithNoTests",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand --forceExit",
    "test:cov": "jest --coverage",
    "lint": "eslint \"{src,test}/**/*.ts\" --max-warnings 0",
    "lint:fix": "eslint \"{src,test}/**/*.ts\" --fix",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts"
  }
}
```

## Anti-patterns

### npm install Instead of npm ci

```yaml
# BAD — resolves dependencies fresh every time; can silently change versions
- run: npm install

# GOOD — deterministic install from lockfile
- run: npm ci
```

### No Dependency Caching

```yaml
# BAD — downloads all packages on every run (~60s)
- uses: actions/setup-node@v4
  with:
    node-version: '22'
- run: npm ci

# GOOD — cache:npm restores node_modules from cache on cache hit
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
- run: npm ci
```

### SQLite for E2E Tests in CI

```yaml
# BAD — SQLite ignores FK constraints, lacks JSON types, behaves differently
DATABASE_URL: sqlite::memory:

# GOOD — real PostgreSQL via services
services:
  postgres:
    image: postgres:16-alpine
    ...
```

### No Lint Step

```yaml
# BAD — lint failures only surface as type errors during build, much later
- run: npm ci
- run: npm test
- run: npm run build

# GOOD — fail fast on lint issues
- run: npm ci
- run: npm run lint
- run: npm test
- run: npm run build
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| PR validation | CI workflow: lint + test + build |
| E2E with real DB | `services: postgres` in GitHub Actions |
| Container release | CD workflow triggered by `v*.*.*` tag push |
| Manual deploy to staging | `workflow_dispatch` trigger on CD workflow |
| Slow E2E tests | `--runInBand` for isolation; Testcontainers parallel in unit tests |
| Secrets in CI | GitHub Actions Secrets; never hardcode in workflow YAML |
