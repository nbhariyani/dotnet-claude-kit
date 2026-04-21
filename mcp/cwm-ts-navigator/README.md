# cwm-ts-navigator

A read-only TypeScript code navigation MCP server for NestJS projects. Uses `ts-morph` to introspect TypeScript source via the TypeScript compiler API, returning token-optimized responses (file paths, line numbers, short snippets — never full file contents).

## Setup

```bash
cd mcp/cwm-ts-navigator
npm install
npm run build
```

For local development without building:

```bash
npm run dev -- --tsconfig /path/to/your/project/tsconfig.json
```

## Configuration

Point the server at a project's `tsconfig.json` via the `--tsconfig` flag. Without it, the server walks up from CWD searching for the nearest `tsconfig.json`.

### Claude Code Integration

Add to `mcp-configs/mcp-servers.json` (already present in this repo):

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

Or run the built binary directly:

```json
{
  "mcpServers": {
    "cwm-ts-navigator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/cwm-ts-navigator/dist/index.js", "--tsconfig", "${workspaceFolder}/tsconfig.json"]
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `find_symbol` | Find where a class, interface, function, enum, or type alias is declared |
| `find_references` | Find all usages of a named symbol across the project |
| `find_implementations` | Find all classes that implement a given interface |
| `find_callers` | Find all call sites of a method, optionally scoped to a class |
| `find_dead_code` | Find exported symbols with zero external references |
| `get_type_hierarchy` | Get extends/implements/implementedBy for a class |
| `get_public_api` | List all exported symbols with signatures from a file |
| `get_diagnostics` | Get TypeScript compiler errors/warnings for a file or project |
| `get_module_graph` | Parse NestJS `@Module()` decorators and return the dependency graph |
| `get_dependency_graph` | Return the file import tree up to a specified depth |
| `get_test_coverage_map` | Check which source files have corresponding `.spec.ts` files |
| `detect_antipatterns` | Scan for NestJS antipatterns (console.log, synchronize:true, missing @ApiProperty, etc.) |
| `detect_circular_deps` | Detect circular import chains, returning each cycle as a file path list |

## Key Design Decisions

- **Read-only** — no tool generates or modifies code
- **Token-optimized** — responses contain paths, line numbers, and ≤80-char previews; never full source
- **Graceful loading** — tools return `{ status: 'loading' }` while the project initializes rather than erroring
- **Error isolation** — each tool catches its own errors and returns `{ error: "..." }` rather than crashing the server
