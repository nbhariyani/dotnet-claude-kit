---
description: >
  Multi-layer NestJS security audit covering known CVEs, secrets, input validation,
  authentication coverage, security headers, and CORS. Reports severity per finding
  with remediation steps. Triggers on: "security scan", "security audit",
  "check for vulnerabilities", "is this secure".
---

# /security-scan

## What

Runs a 6-layer security audit specifically tuned for NestJS applications. Each layer
targets a distinct attack surface. Findings are reported with severity and a specific
remediation step — not vague recommendations.

## When

- "security scan"
- "security audit"
- "check for vulnerabilities"
- "is this secure"
- Before any production deployment
- After adding new authentication or authorization logic

## How

### Layer 1: Known CVEs

```bash
npm audit --audit-level=moderate
```

Report all moderate, high, and critical findings. `npm audit fix` for safe upgrades.
Flag packages requiring manual major version bumps.

### Layer 2: Secrets and Dangerous Patterns

```
detect_antipatterns
```

Flag:
- Hardcoded strings passed to `JwtModule.register({ secret: '...' })`
- `synchronize: true` in TypeORM config (destructive in production)
- `process.env.X` used directly instead of `ConfigService`
- `.env` file committed to the repository

### Layer 3: Input Validation

Check `main.ts` for:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // strips unknown properties
  forbidNonWhitelisted: true,
  transform: true,
}));
```

Flag missing `whitelist: true` as High — unknown properties reach services unchecked.

### Layer 4: Authentication Coverage

```
find_symbol APP_GUARD
find_symbol @Public
```

Verify a global `APP_GUARD` is registered. Every route must either be covered by the
guard or explicitly decorated `@Public()`. Undecorated endpoints are a finding.

### Layer 5: Security Headers

Check `main.ts` for:

```typescript
app.use(helmet());
```

Missing helmet is a Medium finding. Document which headers it would set (CSP, HSTS,
X-Frame-Options, X-Content-Type-Options).

### Layer 6: CORS Configuration

Check for `origin: '*'` or `origin: true` in any environment config. These are
Critical in production. Expected pattern:

```typescript
app.enableCors({ origin: config.getOrThrow('ALLOWED_ORIGINS').split(',') });
```

### Report Format

| Severity | Layer | Finding | File | Fix |
|---|---|---|---|---|
| Critical | Secrets | Hardcoded JWT secret | auth.module.ts:8 | Use ConfigService.getOrThrow |
| High | Validation | whitelist:true missing | main.ts:12 | Add to ValidationPipe options |
| Medium | Headers | helmet() not applied | main.ts | Add app.use(helmet()) |

## Example

```
Layer 1: CVEs        — 0 critical, 1 moderate (ws@7.x)
Layer 2: Secrets     — CRITICAL: hardcoded secret in auth.module.ts:8
Layer 3: Validation  — PASS
Layer 4: Auth guard  — PASS (APP_GUARD registered, 3 @Public routes)
Layer 5: Headers     — MEDIUM: helmet() not in main.ts
Layer 6: CORS        — PASS (explicit origin list)

2 findings require immediate action before production.
```

## Related

- `/verify` -- Full build + test + lint pipeline
- `/health-check` -- Broader project health including coverage
