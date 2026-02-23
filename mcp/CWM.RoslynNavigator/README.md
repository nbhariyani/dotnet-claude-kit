# CWM.RoslynNavigator — Roslyn MCP Server

> Token-efficient .NET codebase navigation via Roslyn semantic analysis.

## Overview

CWM.RoslynNavigator is a Model Context Protocol (MCP) server that provides Claude Code with semantic understanding of .NET solutions. Instead of reading entire source files (hundreds of tokens), Claude can query for specific symbols, references, and type hierarchies (tens of tokens).

## Prerequisites

- .NET 10 SDK
- A .NET solution file (`.sln` or `.slnx`)

## Tools

| Tool | Description | Token Savings |
|------|-------------|--------------|
| `find_symbol` | Find where a type/method/property is defined | ~30-50 tokens vs 500+ loading files |
| `find_references` | All usages of a symbol across the solution | ~50-150 tokens vs 2000+ scanning |
| `find_implementations` | What implements an interface/overrides a method | ~30-80 tokens |
| `get_type_hierarchy` | Inheritance chain + interfaces for a type | ~40-100 tokens |
| `get_project_graph` | Solution project dependency tree | ~50-200 tokens |
| `get_public_api` | Public members of a type (without full file) | ~100 tokens vs 500+ for full file |
| `get_diagnostics` | Compiler + analyzer warnings/errors | ~50-300 tokens |

## Installation

### As a Global Tool (Recommended)

```bash
dotnet tool install -g CWM.RoslynNavigator
```

Then add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "cwm-roslyn-navigator": {
      "command": "cwm-roslyn-navigator",
      "args": ["--solution", "${workspaceFolder}"]
    }
  }
}
```

### As a Local Tool (per-repo)

```bash
dotnet new tool-manifest   # if you don't have one
dotnet tool install CWM.RoslynNavigator
```

Then reference with `dotnet tool run`:

```json
{
  "mcpServers": {
    "cwm-roslyn-navigator": {
      "command": "dotnet",
      "args": ["tool", "run", "cwm-roslyn-navigator", "--", "--solution", "${workspaceFolder}"]
    }
  }
}
```

### From Source (for contributors)

```bash
dotnet run --project mcp/CWM.RoslynNavigator/CWM.RoslynNavigator.csproj -- --solution /path/to/your/Solution.sln
```

## Architecture

```
Program.cs              → MSBuildLocator → Host → MCP stdio transport
WorkspaceManager.cs     → MSBuildWorkspace lifecycle, file watching, compilation caching
WorkspaceInitializer.cs → BackgroundService triggers workspace load on startup
SolutionDiscovery.cs    → Auto-detect .sln/.slnx from args or working directory
SymbolResolver.cs       → Cross-project symbol resolution with disambiguation
Tools/                  → MCP tool implementations (7 read-only tools)
Responses/              → Token-optimized JSON response DTOs
```

## Scaling

| Solution Size | Strategy |
|---|---|
| Small (1-15 projects) | Load entire workspace on startup, keep compilations warm |
| Large (15-50 projects) | Lazy-load compilations on first query per project |
| Enterprise (50+) | Lazy loading + warn if query touches unloaded project |

## Development

```bash
# Build
dotnet build mcp/CWM.RoslynNavigator/CWM.RoslynNavigator.csproj

# Run tests
dotnet test mcp/CWM.RoslynNavigator/tests/CWM.RoslynNavigator.Tests.csproj

# Run manually
dotnet run --project mcp/CWM.RoslynNavigator/CWM.RoslynNavigator.csproj -- --solution ./path/to/solution.sln
```
