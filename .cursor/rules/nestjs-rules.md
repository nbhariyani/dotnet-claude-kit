# NestJS Development Rules (Cursor IDE)

> NestJS and TypeScript-focused project rules for this repository.

---

## 1. TypeScript Style

### File Organization
- One primary class or exported type per file.
- File names use kebab-case (`orders.service.ts`, `create-order.dto.ts`).
- Keep DTOs, entities, guards, filters, and interceptors in clearly named folders.

### Type Declarations
- Prefer strict TypeScript types over `any`.
- Use classes for DTOs that need validation decorators.
- Use interfaces or type aliases for internal contracts when decorators are not required.
- Export only what other modules actually consume.

### General Conventions
- Async methods use the `Async` suffix only if the repo already standardizes on it; otherwise follow local NestJS conventions consistently.
- Prefer `readonly` constructor injection for services.
- Keep controllers thin and move business logic into services or use-case layers.
- Use response DTOs at API boundaries instead of returning entities directly.

---

## 2. Architecture

- **Do not assume one architecture fits every project.** Use the architecture guidance already defined in the repo, but keep NestJS module boundaries explicit.
- **Feature modules are the default practical baseline.** Group code by domain (`orders`, `users`, `billing`) instead of global layer folders where possible.
- **Modules share providers via `exports[]` only.** Never import another module's service class directly from its file path.
- **`AppModule` is a registry, not a feature.** Keep business logic out of the root module.
- **Avoid circular module dependencies.** If two modules need each other, extract a shared module or contract.
- **`@Global()` only for infrastructure modules.** Config, logging, database, or other true cross-cutting platform concerns only.

---

## 3. Security

- **Never hardcode secrets in source code.** Use environment variables plus validated configuration.
- **Use `@nestjs/config` and schema validation.** Services should not read `process.env` directly.
- **Protect routes by default.** Prefer `APP_GUARD` with `@Public()` for explicit opt-out.
- **Use `@Roles()` or equivalent policy decorators** for privileged routes.
- **Validate all external input at system boundaries.** DTOs plus global `ValidationPipe`.
- **CORS must be explicit in production.** No wildcard origins unless the deployment really requires it.
- **Do not log PII or secrets** in application logs.
- **Use Helmet and throttling intentionally** for HTTP-facing APIs.

---

## 4. Testing

- **E2E tests are the highest-value API tests.** Use Jest + SuperTest against a real Nest app.
- **Use Testcontainers when database behavior matters.** Avoid fake database behavior for persistence-heavy flows.
- **Mirror production bootstrap in tests** when guards, pipes, filters, or interceptors affect behavior.
- **Unit test service logic separately** with `createTestingModule` and mock providers only where needed.
- **Test observable behavior.** Assert on HTTP responses, persisted state, emitted events, or side effects.

---

## 5. Performance

- **Avoid N+1 query patterns.** Use proper relations, joins, batching, or query shaping.
- **Use transactions explicitly** for multi-step writes that must succeed or fail together.
- **Do not block async flow.** Avoid sync wrappers around async database or network calls.
- **Use structured logging** instead of `console.log`.
- **Cache intentionally.** Add Redis or `cache-manager` only where repeated expensive reads justify it.

---

## 6. Error Handling

- **Throw typed NestJS exceptions for expected HTTP failures.**
- **Do not use try-catch for normal control flow.**
- **Keep exception mapping centralized** with filters or consistent service-layer behavior.
- **Do not swallow errors.** Either handle them with context or let them propagate to the global exception layer.
- **Return predictable API error shapes** so clients are not forced to infer failure formats.

| Scenario | Preferred Approach |
|---|---|
| Validation failure | DTO validation + `ValidationPipe` |
| Missing resource | `NotFoundException` |
| Conflict | `ConflictException` |
| Unauthorized | `UnauthorizedException` |
| Forbidden | `ForbiddenException` |
| Unexpected crash | Global exception filter + structured logging |

---

## 7. Git Workflow

- **Use conventional commits** such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- **Commit related code and tests together.**
- **Keep PRs focused on a single concern** where possible.
- **Run verification before opening a PR.** At minimum: lint, tests, and build.
- **Do not bypass hooks casually.** Fix the root cause instead.

---

## 8. Agent and Tool Usage

- **Prefer MCP tools before broad file reads** when symbol, reference, graph, or diagnostic tools can answer the question.
- **Use `get_module_graph` before structural changes** in larger NestJS projects.
- **Use `get_diagnostics` after modifications** before falling back to full builds for TypeScript issues.
- **Route work to specialist agents** using the repo's `AGENTS.md`.
- **Load relevant skills before implementation** when the task touches auth, persistence, testing, security, or API design.

---

## 9. Hooks

- **Accept auto-formatting hooks** when they apply standard repo formatting.
- **Do not revert hook-driven formatting** unless the hook is clearly wrong.
- **Read failing hook output carefully** and fix the underlying issue.
- **Let scaffold or restore hooks finish** before evaluating generated project state.

---

## 10. Package Management

- **Do not hardcode old package versions from memory.**
- **Keep NestJS major versions aligned** across `@nestjs/*` packages.
- **Prefer stable releases** unless the project intentionally targets preview features.
- **Do not downgrade existing packages casually.**
- **Document important package additions** when they affect architecture, security, or operations.
