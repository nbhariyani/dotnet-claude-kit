---
alwaysApply: true
description: >
  Git workflow conventions: conventional commits, branch naming, atomic commits,
  and PR process. Technology-agnostic.
---

# Git Workflow Rules

## Commit Messages

- **DO** use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`.
  Rationale: Enables automated changelogs, semantic versioning, and scannable git history.

- **DO** write the commit body to explain "why", not "what". The diff shows what changed.

- **DON'T** write vague messages like "fix bug" or "update code".

## Branch Naming

- **DO** use prefixed branch names: `feature/`, `fix/`, `refactor/`.
- **DON'T** use personal or opaque branch names like `my-branch` or `wip`.

## Atomic Commits

- **DO** make one logical change per commit. A feature and its tests belong together.
- **DON'T** bundle unrelated changes in a single commit.

## Branch Safety

- **DON'T** force-push to `main` or `master`. Ever.
- **DON'T** skip pre-commit hooks with `--no-verify`.

## PR Process

- **DO** run `/verify` before creating a PR.
- **DO** keep PRs focused on a single concern.

## Quick Reference

| Action | Convention |
|---|---|
| New feature | `feat: add order export endpoint` |
| Bug fix | `fix: prevent duplicate payments on retry` |
| Refactor | `refactor: extract pricing logic from OrdersService` |
| Tests only | `test: add edge cases for discount calculation` |
| Branch for feature | `feature/order-export` |
| Branch for fix | `fix/duplicate-payment` |
