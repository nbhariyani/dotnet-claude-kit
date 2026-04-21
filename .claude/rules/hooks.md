---
alwaysApply: true
description: >
  Hook rules for NestJS projects: accept format hooks, never skip pre-commit
  hooks, investigate failures rather than bypassing them.
---

# Hook Rules (NestJS)

## Format Hooks

- **DO** auto-accept post-edit format hooks. They enforce consistent Prettier and
  ESLint style automatically.
  Rationale: Format hooks maintain codebase consistency. Fighting them creates churn.

- **DON'T** revert or undo formatting changes applied by hooks.
  Rationale: The hook output is the canonical style. Manual overrides cause style drift.

## Pre-Commit Hooks

- **DON'T** skip pre-commit hooks with `--no-verify`. Ever.
  Rationale: Pre-commit hooks catch real issues (TypeScript errors, lint failures,
  format violations). Bypassing them pushes broken code.

- **DO** investigate and fix the root cause when a hook blocks a commit.
  Rationale: The hook is signaling a real problem. Silencing it hides the problem.

## Post-Test Analysis

- **DO** review post-test-analyze hook output. It contains actionable test quality
  and coverage insights.

## Hook Infrastructure

- **DON'T** interfere with hook configuration. Hooks run automatically.
- **DO** wait for post-package-install to complete after `package.json` changes
  before building.
  Rationale: `npm install` must finish before the build can resolve new dependencies.

## Quick Reference

| Hook | Correct Response |
|---|---|
| Post-edit format | Accept the changes |
| Pre-commit failure | Fix the issue, commit again |
| Post-test-analyze | Read and act on insights |
| Post-package-install | Wait for completion before building |
