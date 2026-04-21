# Contributing to nestjs-claude-kit

## Before You Start

1. Read [CLAUDE.md](CLAUDE.md).
2. Read [AGENTS.md](AGENTS.md).
3. Check the spec at [docs/nestjs-claude-kit-SPEC.md](docs/nestjs-claude-kit-SPEC.md).

## What We Maintain

The repo is made of:

- `skills/` for technical and workflow guidance
- `agents/` for role-based routing
- `commands/` for common workflows
- `templates/` for project starting points
- `knowledge/` for supporting reference material
- `mcp/cwm-ts-navigator/` for TypeScript code navigation
- `.claude/rules/` for always-on repo guidance

## Contribution Standards

- Keep skills concise and practical.
- Prefer modern NestJS and TypeScript patterns.
- Keep examples aligned with the current stack in the repo.
- Avoid reintroducing `.NET` or C# guidance unless the file is explicitly archival.
- Keep cross-references accurate when files are renamed or replaced.

## Skills

Each skill lives at `skills/<skill-name>/SKILL.md`.

A strong skill should include:

- a clear purpose
- practical defaults
- short code examples
- anti-patterns
- a decision guide

## Agents and Commands

Agent and command docs should stay aligned with:

- current skills
- current routing rules in `AGENTS.md`
- current MCP tooling
- current templates

## MCP Server

The MCP server for this repo lives at `mcp/cwm-ts-navigator/`.

Typical local workflow:

```bash
cd mcp/cwm-ts-navigator
npm install
npm run build
npm test
```

## Verification

Before submitting significant changes:

- run the relevant build/test commands
- check cross-links
- keep docs aligned with actual repo contents
- avoid stale stack references

## Style

- Be specific and practical.
- Prefer short sections over giant walls of text.
- Keep examples current for NestJS, TypeScript, and the repo's current tools.

## Collaboration

Be kind, be constructive, and leave the repo more internally consistent than you found it.
