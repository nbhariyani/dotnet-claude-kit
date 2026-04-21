# Changelog

## Unreleased

### Changed

- Repositioned the repository from `dotnet-claude-kit` toward `nestjs-claude-kit`
- Reworked agents, commands, skills, knowledge files, templates, and MCP configuration around NestJS and TypeScript
- Replaced Roslyn-oriented guidance with `cwm-ts-navigator` and ts-morph-oriented guidance
- Rewrote shared workflow/meta skills to remove `.NET`-specific assumptions
- Rewrote knowledge docs around NestJS anti-patterns, package choices, infrastructure, and architecture decisions

### Added

- NestJS-focused agents such as `nestjs-architect` and `orm-specialist`
- NestJS-focused templates for REST API, modular monolith, shared library, and worker scenarios
- TypeScript/NestJS skill set additions such as `controllers`, `feature-modules`, `typeorm`, `prisma`, `guards`, `pipes`, and `validation`
- npm publishing workflow and Node-oriented MCP server documentation

### Removed

- Legacy `.NET`-specific guidance that no longer matches the repo direction
- Roslyn MCP implementation from the active product story
- NuGet-oriented publishing and `.NET`-specific project templates from the current default positioning
