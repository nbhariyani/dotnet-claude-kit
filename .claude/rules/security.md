---
alwaysApply: true
description: >
  NestJS security rules: secrets management, helmet, CORS, JWT config,
  input validation, and no PII in logs.
---

# Security Rules (NestJS)

## Secrets Management

- **Never hardcode secrets in source code.** Use `@nestjs/config` + environment
  variables for local dev; use secrets manager (AWS SSM, Azure Key Vault) in production.
  Rationale: Hardcoded secrets end up in git history and are nearly impossible to fully purge.

```typescript
// DO
config.getOrThrow<string>('JWT_SECRET')

// DON'T
JwtModule.register({ secret: 'my-super-secret' })
```

- **Never commit `.env` files with real credentials.** Add `.env` to `.gitignore`.
  Use `.env.example` with placeholder values as the committed reference.

## HTTP Security Headers

- **DO** apply `helmet()` middleware in `main.ts` before all routes.
  Rationale: Helmet sets security headers (CSP, HSTS, X-Frame-Options, etc.) that
  protect against common web vulnerabilities.

```typescript
import helmet from 'helmet';
app.use(helmet());
```

## CORS

- **Explicit origins only in production — never `origin: true` or `origin: '*'`.**
  Rationale: Wildcard CORS exposes your API to every domain on the internet.

```typescript
// DO
app.enableCors({ origin: config.getOrThrow('ALLOWED_ORIGINS').split(',') });

// DON'T
app.enableCors({ origin: '*' });
```

## Authentication and Authorization

- **Every endpoint is protected by default via `APP_GUARD`.** Use `@Public()` to
  explicitly opt out. Unlabeled endpoints are a security hole.
  Rationale: Opt-out is safer than opt-in — new routes are protected by default.

- **Use `@Roles()` explicitly on every admin/privileged route.**

## Input Validation

- **`ValidationPipe` with `whitelist: true` is mandatory globally.**
  Rationale: Without it, unvalidated properties reach services and can cause
  unintended data mutation.

## Logging

- **Do not log PII (emails, IPs, names, tokens) at `info` level or above.**
  Rationale: Log aggregators are broadly accessible. PII in logs is a compliance
  liability and a breach risk.

## DO / DON'T Quick Reference

| DO | DON'T |
|---|---|
| `config.getOrThrow('JWT_SECRET')` | `secret: 'hardcoded'` |
| `app.use(helmet())` in main.ts | Skip security headers |
| `app.enableCors({ origin: ['https://app.example.com'] })` | `origin: '*'` in production |
| `APP_GUARD` + `@Public()` for public routes | Unguarded endpoints |
| `ValidationPipe({ whitelist: true })` globally | No global validation |
| Debug-level logging for PII | `logger.info({ email })` |
