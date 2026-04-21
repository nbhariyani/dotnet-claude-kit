---
name: de-sloppify
description: >
  Code quality cleanup workflow for NestJS projects. Load this skill when asked
  to clean up code, de-sloppify, improve code quality, remove dead code, fix unused
  imports, resolve stale TODOs, or detect circular dependencies.
---

## Core Principles

1. **Work in committed steps.** Each cleanup step is a separate commit. This makes
   it easy to bisect if a cleanup accidentally broke something.

2. **Automated fixes first, manual last.** Run lint:fix and format before any manual
   changes. Manual cleanup of already-auto-fixable issues wastes time.

3. **Dead code is technical debt.** Unused exports, unused variables, and unreachable
   code all increase cognitive load for the next developer and the context window
   for AI tools.

4. **Circular dependencies are architecture bugs.** They indicate that module
   boundaries are wrong. Fix the architecture; do not patch with `forwardRef()`.

5. **Never silence a lint rule without a written justification.** `eslint-disable`
   without a comment is a code smell. If the rule is wrong for a specific case,
   document why.

## Patterns

### Full De-Sloppify Sequence (Run in Order)

**Step 1: Auto-fix lint and formatting**
```bash
npm run lint:fix
npm run format    # or npx prettier --write "src/**/*.ts"
git add -p
git commit -m "chore: auto-fix lint and format"
```

**Step 2: Remove unused imports**
```bash
# ESLint rule @typescript-eslint/no-unused-vars catches most
# Also check: @typescript-eslint/no-unused-imports (if configured)
npm run lint
# Fix any remaining unused import warnings manually
git add -p
git commit -m "chore: remove unused imports"
```

**Step 3: Fix remaining lint warnings (manual)**
```bash
npm run lint
# Address any warnings that lint:fix could not auto-resolve
# Common: explicit return types, unnecessary type assertions, any usage
git add -p
git commit -m "chore: resolve lint warnings"
```

**Step 4: Find dead code (MCP)**
```
find_dead_code({ path: "src/" })
```
Remove any exported functions, classes, or modules that have no callers.
```bash
git add -p
git commit -m "chore: remove dead code"
```

**Step 5: Resolve or remove stale TODOs**
```bash
# Find all TODOs
grep -r "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts"
```
For each TODO:
- If it is resolved by recent work: delete the comment.
- If it is still needed: convert to a GitHub issue, replace comment with issue link.
- If it is no longer relevant: delete it.
```bash
git add -p
git commit -m "chore: resolve stale TODOs"
```

**Step 6: Detect circular dependencies (MCP)**
```
detect_circular_deps({ path: "src/" })
```
If circular deps are found:
- Identify the shared concern causing the cycle.
- Extract it into a new module or move it to `common/`.
- Do not patch with `forwardRef()` unless it is truly unavoidable (e.g., self-referential entity).
```bash
git add -p
git commit -m "refactor: break circular dependency in <module>"
```

**Step 7: Find missing await / async anti-patterns (MCP)**
```
detect_antipatterns({ path: "src/", patterns: ["missing-await", "sync-over-async"] })
```
Fix each finding individually. A missing `await` in a service is a bug, not just style.
```bash
git add -p
git commit -m "fix: add missing await in <service>"
```

### ESLint Config for Catching Slop

```javascript
// eslint.config.js (or .eslintrc.js) — rules that catch common slop
module.exports = {
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    'no-console': 'error',
  },
};
```

### Cleaning Up an Overgrown AppModule

```typescript
// BAD — AppModule is a dumping ground
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Product, Payment, Notification]),
    // 20 more feature modules inlined here
  ],
  providers: [OrdersService, UsersService, /* ... all services */],
})
export class AppModule {}

// GOOD — AppModule only imports feature modules
@Module({
  imports: [
    DatabaseModule,
    OrdersModule,
    UsersModule,
    ProductsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
```

## Anti-patterns

### Silencing ESLint Rules Without Justification

```typescript
// BAD
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result: any = compute();

// GOOD — fix the type, or document why any is unavoidable
const result: ComputeResult = compute();
// or when truly unavoidable:
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party lib returns untyped response
const result: any = thirdPartyLib.compute();
```

### Skipping Steps 4-7

```
// BAD — stop after lint:fix and call it done
// Steps 4-7 catch bugs and architectural issues that lint cannot find.
// A project with clean lint but circular deps and missing awaits is still sloppy.
```

### All Steps in One Commit

```bash
# BAD — one giant commit; hard to bisect if cleanup broke something
git add .
git commit -m "chore: clean up code"

# GOOD — one commit per step (see sequence above)
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Quick cleanup after feature | Steps 1-3 only |
| Pre-PR quality check | Full 7-step sequence |
| Circular dependency detected | Extract shared code; avoid forwardRef() |
| TODO older than 30 days | Convert to GitHub issue or delete |
| Missing await in service | Fix immediately — it is a correctness bug |
| Large file (300+ lines) | Consider splitting into smaller focused files |
| Unused exported function | Delete it; if it is a public API, deprecate first |
