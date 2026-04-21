import { ProjectManager } from '../ProjectManager.js';
import path from 'path';

interface DependencyNode {
  filePath: string;
  imports: DependencyNode[];
}

export const GetDependencyGraphTool = {
  definition: {
    name: 'get_dependency_graph',
    description: 'Return the file import tree for a given file up to a specified depth.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'The file to build the import tree from.',
        },
        depth: {
          type: 'number',
          description: 'How many levels deep to traverse. Default: 2.',
        },
      },
      required: ['filePath'],
    },
  },

  async execute(args: { filePath: string; depth?: number }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const maxDepth = args.depth ?? 2;

      const normalizedInput = args.filePath.replace(/\\/g, '/');
      const rootFile = project.getSourceFiles().find((sf) => {
        const fp = sf.getFilePath().replace(/\\/g, '/');
        return fp === normalizedInput || fp.endsWith('/' + normalizedInput);
      });

      if (!rootFile) {
        return JSON.stringify({ error: `File not found in project: ${args.filePath}` });
      }

      const visited = new Set<string>();

      function buildGraph(filePath: string, currentDepth: number): DependencyNode {
        const node: DependencyNode = { filePath, imports: [] };
        if (currentDepth >= maxDepth) return node;
        if (visited.has(filePath)) return node;
        visited.add(filePath);

        const sf = project.getSourceFile(filePath);
        if (!sf) return node;

        for (const importDecl of sf.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();
          // Skip node_modules imports
          if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) continue;

          const resolvedSf = importDecl.getModuleSpecifierSourceFile();
          if (!resolvedSf) continue;

          node.imports.push(buildGraph(resolvedSf.getFilePath(), currentDepth + 1));
        }

        return node;
      }

      const graph = buildGraph(rootFile.getFilePath(), 0);
      return JSON.stringify({ graph });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
