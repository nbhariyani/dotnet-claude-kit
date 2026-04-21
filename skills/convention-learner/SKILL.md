---
name: convention-learner
description: >
  Detects and enforces project-specific coding conventions by analyzing the
  existing codebase. Learns naming conventions, folder structure, test
  organization, module boundaries, and coding style from the repository
  before generating new code.
---

# Convention Learner

## Core Principles

1. **Observe before enforcing** - Detect existing patterns before applying defaults.
2. **Project conventions override generic defaults** - If the codebase consistently uses one pattern, follow it unless explicit instructions say otherwise.
3. **Use MCP tools first** - Module graphs, public API summaries, references, and diagnostics give better evidence than random file browsing.
4. **Document findings** - Good conventions should be written down in project docs or memory.
5. **Consistency over theoretical purity** - Match the project's pattern when it is deliberate and stable.

## Patterns

### Convention Detection Flow

**Step 1: Project structure**

```text
-> get_module_graph
Detect:
- feature modules vs layer folders
- shared/common module patterns
- cross-module imports and exports
- test placement and naming
```

**Step 2: Type naming patterns**

```text
-> get_public_api on representative controllers, services, DTOs, modules
Detect:
- suffixes: Controller, Service, Guard, Pipe, Interceptor, Repository
- DTO naming: CreateXDto, UpdateXDto, ResponseDto, QueryDto
- file naming: kebab-case vs camelCase vs PascalCase
- export style and barrel usage
```

**Step 3: Folder structure**

Look for patterns such as:

- `src/users/users.module.ts` style feature folders
- shared code under `src/common/`
- transport-specific folders like `dto/`, `entities/`, `guards/`, `interceptors/`
- monorepo app/lib boundaries

**Step 4: Configuration detection**

Check explicit convention setters:

- `tsconfig.json`
- ESLint/Biome/Prettier config
- Nest CLI config
- testing config (`jest.config.*`)

**Step 5: Build a summary**

```markdown
## Detected Conventions

### Naming
- Controllers end with `Controller`
- Services end with `Service`
- DTOs use `CreateXDto` / `UpdateXDto`

### Structure
- Feature modules under `src/<feature>/`
- Shared helpers under `src/common/`

### Style
- Strict TypeScript enabled
- Files use kebab-case
- Validation decorators on DTOs, not inline checks
```

### Convention Enforcement

When generating code, mirror the detected patterns.

Example:

```ts
// If the repo uses feature folders with DTO subfolders:
src/orders/
  dto/
    create-order.dto.ts
  orders.controller.ts
  orders.service.ts
  orders.module.ts
```

When reviewing code, flag meaningful deviations:

```text
Convention deviation:
The repo uses feature-local DTO folders, but this PR places DTOs under a new global folder.
Unless this is an intentional architectural shift, keep the new DTO next to its feature.
```

### Anti-pattern Tracking

Use `detect_antipatterns` periodically to find recurring issues:

```text
- missing validation decorators
- direct process.env reads instead of ConfigService
- cross-module private imports
- `any` spreading through service boundaries
- console logging in production code
```

If a pattern recurs, promote it into CLAUDE.md or MEMORY.md as an explicit convention.

## Anti-patterns

### Enforcing Without Detecting

```text
BAD:
Impose a new folder structure without checking what the repo already does

GOOD:
Detect the existing structure first and follow it
```

### Overriding Explicit Project Rules

```text
BAD:
Ignore linting or tsconfig constraints because the kit prefers something else

GOOD:
Respect the repo's explicit config
```

### Applying Generic Advice to Specialized Repos

```text
BAD:
Force a standard REST module layout onto a monorepo library package

GOOD:
Fit the generated code to the local package or app structure
```

### Documenting Conventions Without Evidence

```text
BAD:
Declare a repo convention after reading one file

GOOD:
Confirm patterns across several representative files or modules first
```

## Decision Guide

| Scenario | Action | Tool |
|----------|--------|------|
| Joining an existing project | Run the full detection flow | MCP + targeted reads |
| Generating new code | Check detected conventions first | Previous findings |
| Reviewing code | Compare against detected conventions | MCP + local context |
| Project config conflicts with default advice | Project config wins | Config files |
| No clear conventions detected | Use kit defaults and document them | Applicable skill |
| Recurring antipattern found | Add a rule to CLAUDE.md or memory | detect_antipatterns |
