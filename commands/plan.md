---
description: >
  Enter plan mode for NestJS projects with architecture awareness. Analyzes tasks
  through the lens of supported architectures (Feature Modules, Clean Architecture,
  DDD, Modular Monolith) and produces structured implementation plans before any code
  is written. Use when: "plan", "let's plan", "think through", "design this",
  "how should I implement", or any non-trivial task requiring 3+ steps.
---

# /plan -- Architecture-Aware Planning

## What

Enters a structured planning mode that considers the project's architecture pattern
before producing an implementation plan. Instead of jumping straight to code, this
command forces a deliberate pause to:

- Identify the project's current architecture (or recommend one)
- Map the task to affected layers, modules, and boundaries
- Produce a numbered implementation plan with clear steps
- Iterate on the plan until it is solid before writing any code

Plans are living documents -- if something goes sideways during implementation,
stop and re-plan rather than pushing through a broken approach.

## When

- Non-trivial tasks requiring 3 or more implementation steps
- Tasks involving architectural decisions (new modules, cross-cutting concerns, new bounded contexts)
- Features that touch multiple layers (controller, service, repository, infrastructure)
- Refactoring that could affect multiple consumers
- Any time the user says "plan", "think through", "design this", or "how should I approach"

**Skip planning for:** Single-file changes, simple bug fixes, typo corrections, config tweaks.

## How

### Step 1: Understand the Task

Clarify what the user wants to build. Ask focused questions if the request is ambiguous.
Do not assume requirements that were not stated.

### Step 2: Detect Architecture

Use the `architecture-advisor` skill to determine the project's architecture:
- Check for existing architecture markers (folder structure, module patterns)
- If no architecture is established, run the architecture questionnaire
- Load the appropriate architecture-specific skill (feature-modules, clean-architecture, ddd)

### Step 3: Map Affected Areas

Identify every layer, module, and boundary the task touches:
- Which folders will have new or modified files?
- Are there cross-cutting concerns (auth, caching, validation, logging)?
- What existing code will be impacted? Use `find_references` and `find_callers` MCP tools for blast radius.
- Are there database migrations needed?

### Step 4: Produce the Plan

Output a numbered plan with this structure:

```
## Plan: [Task Title]

**Architecture:** [Detected architecture]
**Affected layers:** [List]
**Estimated steps:** [Count]

### Steps
1. [Step] -- [Which file/module] -- [Why this order]
2. ...

### Open Questions
- [Anything that needs user input before proceeding]

### Risks
- [Potential issues and mitigations]
```

### Step 5: Iterate

Present the plan and ask: "Does this plan look right, or should I adjust anything?"
Revise until the user confirms. Only then proceed to implementation.

## Example

```
User: /plan Add a product catalog feature with search and filtering

Claude: Let me analyze your project structure first...

## Plan: Product Catalog Feature

**Architecture:** Feature Modules
**Affected layers:** src/products/, src/app.module.ts, migrations/
**Estimated steps:** 6

### Steps
1. Create Product entity + TypeORM config -- src/products/entities/ -- Foundation for everything else
2. Generate migration -- migrations/ -- Schema must exist before features
3. Scaffold ProductsModule with controller + service -- src/products/ -- Full feature slice
4. Add CreateProductDto + filtering query DTO -- src/products/dto/ -- Input contracts first
5. Add E2E tests -- src/products/products.e2e-spec.ts -- Verify both read and write paths
6. Wire up OpenAPI metadata -- src/products/dto/ -- Documentation

### Open Questions
- Should search be full-text (PostgreSQL tsvector) or simple LIKE?
- Do products need categories for filtering?

Does this plan look right, or should I adjust anything?
```

## Related

- `/scaffold` -- Generate the files once the plan is approved
- `/verify` -- Run verification after implementing the plan
