# MCP Configs

This folder contains recommended MCP server configuration for projects using `nestjs-claude-kit`.

## Primary Server

### `cwm-ts-navigator`

**Purpose:** TypeScript code intelligence for NestJS and TypeScript repositories.

**Use it for:**

- symbol lookup
- references
- diagnostics
- module graph analysis
- circular dependency checks
- dead code detection
- test coverage mapping

**Typical config:**

```json
{
  "mcpServers": {
    "cwm-ts-navigator": {
      "command": "cwm-ts-navigator",
      "args": ["--tsconfig", "${workspaceFolder}/tsconfig.json"],
      "env": {}
    }
  }
}
```

## Additional Servers

This repo also shows examples for:

- `github`
- `filesystem`

Use only the servers your workflow actually needs.
