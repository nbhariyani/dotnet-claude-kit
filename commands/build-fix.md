---
description: >
  Diagnose and fix TypeScript build errors in NestJS projects. Uses get_diagnostics
  MCP tool when available, falls back to tsc --noEmit. Categorizes and fixes errors
  systematically. Triggers on: "fix build errors", "tsc is failing", "build is broken",
  "type errors", "can't compile".
---

# /build-fix

## What

Collects TypeScript errors via `get_diagnostics` (preferred) or `npx tsc --noEmit`,
categorizes them by root cause, and fixes them in a deliberate order — decorator
configuration first, then missing imports, then type errors, then circular
dependencies.

## When

- "fix build errors"
- "tsc is failing"
- "the build is broken"
- "I'm getting type errors"
- After a merge that introduced conflicts in type definitions
- After upgrading NestJS or TypeScript versions

## How

### Step 1: Collect Errors

Use `get_diagnostics` via the cwm-ts-navigator MCP server if available — it returns
structured errors without full compilation. Fall back to:

```bash
npx tsc --noEmit 2>&1 | head -100
```

### Step 2: Categorize Errors

Group errors by type before fixing anything:

| Code | Category | Example |
|---|---|---|
| TS1219 / TS1241 | Decorator metadata | `experimentalDecorators` not set |
| TS2307 | Module not found | Missing package or wrong import path |
| TS2339 | Property missing | Property doesn't exist on type |
| TS2345 | Argument type | Wrong type passed to function |
| TS2532 / TS2531 | Strict null | Possibly undefined access |
| Circular | Circular deps | `detect_circular_deps` MCP tool |

### Step 3: Fix in Priority Order

1. **Decorator metadata** — verify `tsconfig.json`:
   ```json
   { "experimentalDecorators": true, "emitDecoratorMetadata": true }
   ```

2. **Missing imports** — check `package.json`, install missing packages, correct paths.

3. **Type errors** — add null guards, fix generics, correct interface shapes.

4. **Circular dependencies** — run `detect_circular_deps`, extract shared code to
   `CommonModule` or `SharedModule`.

5. **Strict mode violations** — add `?? defaultValue`, optional chaining, or explicit
   type assertions where safe.

### Step 4: Verify

Re-run `get_diagnostics` or `npx tsc --noEmit` after each category fix. Confirm zero
errors before marking done.

## Example Error Categories

```
TS2307: Cannot find module '@/common/filters'    → wrong path alias config
TS1219: Decorators not enabled                   → add experimentalDecorators
TS2339: Property 'user' does not exist on 'Request' → extend Request interface
TS2345: Argument of type 'string' not assignable → fix DTO type annotation
```

## Related

- `/verify` -- Full pipeline check after build is fixed
- `/health-check` -- Broader project health including anti-patterns
