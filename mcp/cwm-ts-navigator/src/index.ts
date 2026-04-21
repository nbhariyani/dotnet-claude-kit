#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ProjectManager } from './ProjectManager.js';
import { FindSymbolTool } from './tools/FindSymbolTool.js';
import { FindReferencesTool } from './tools/FindReferencesTool.js';
import { FindImplementationsTool } from './tools/FindImplementationsTool.js';
import { FindCallersTool } from './tools/FindCallersTool.js';
import { FindDeadCodeTool } from './tools/FindDeadCodeTool.js';
import { GetTypeHierarchyTool } from './tools/GetTypeHierarchyTool.js';
import { GetPublicApiTool } from './tools/GetPublicApiTool.js';
import { GetDiagnosticsTool } from './tools/GetDiagnosticsTool.js';
import { GetModuleGraphTool } from './tools/GetModuleGraphTool.js';
import { GetDependencyGraphTool } from './tools/GetDependencyGraphTool.js';
import { GetTestCoverageMapTool } from './tools/GetTestCoverageMapTool.js';
import { DetectAntipatternsTool } from './tools/DetectAntipatternsTool.js';
import { DetectCircularDepsTool } from './tools/DetectCircularDepsTool.js';

const ALL_TOOLS = [
  FindSymbolTool,
  FindReferencesTool,
  FindImplementationsTool,
  FindCallersTool,
  FindDeadCodeTool,
  GetTypeHierarchyTool,
  GetPublicApiTool,
  GetDiagnosticsTool,
  GetModuleGraphTool,
  GetDependencyGraphTool,
  GetTestCoverageMapTool,
  DetectAntipatternsTool,
  DetectCircularDepsTool,
] as const;

function parseTsconfigArg(): string | undefined {
  const idx = process.argv.indexOf('--tsconfig');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main(): Promise<void> {
  const tsconfigPath = parseTsconfigArg();
  const projectManager = new ProjectManager(tsconfigPath);

  const server = new Server(
    {
      name: 'cwm-ts-navigator',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((tool) => tool.definition),
  }));

  // Register tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = ALL_TOOLS.find((t) => t.definition.name === name);

    if (!tool) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
      };
    }

    const result = await tool.execute(args as any, projectManager);

    return {
      content: [
        {
          type: 'text' as const,
          text: result,
        },
      ],
    };
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
