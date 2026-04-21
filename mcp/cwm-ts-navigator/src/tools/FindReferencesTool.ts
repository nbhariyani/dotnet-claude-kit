import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface ReferenceResult {
  filePath: string;
  line: number;
  preview: string;
}

export const FindReferencesTool = {
  definition: {
    name: 'find_references',
    description:
      'Find all references to a named symbol across the project. Returns file paths, line numbers, and short previews (≤80 chars).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbolName: {
          type: 'string',
          description: 'The symbol name to find references for.',
        },
        filePath: {
          type: 'string',
          description: 'Optional: restrict search to references within this file.',
        },
      },
      required: ['symbolName'],
    },
  },

  async execute(args: { symbolName: string; filePath?: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const results: ReferenceResult[] = [];

      // Find the declaration node first
      const declaringKinds = [
        SyntaxKind.ClassDeclaration,
        SyntaxKind.InterfaceDeclaration,
        SyntaxKind.FunctionDeclaration,
        SyntaxKind.EnumDeclaration,
        SyntaxKind.TypeAliasDeclaration,
        SyntaxKind.MethodDeclaration,
        SyntaxKind.PropertyDeclaration,
        SyntaxKind.VariableDeclaration,
      ];

      let declarationNode: import('ts-morph').Node | undefined;

      for (const sf of project.getSourceFiles()) {
        if (args.filePath && !sf.getFilePath().includes(args.filePath)) continue;
        for (const kind of declaringKinds) {
          const decls = sf.getDescendantsOfKind(kind);
          for (const decl of decls) {
            const nameNode = (decl as any).getNameNode?.();
            if (nameNode && nameNode.getText() === args.symbolName) {
              declarationNode = nameNode;
              break;
            }
          }
          if (declarationNode) break;
        }
        if (declarationNode) break;
      }

      if (!declarationNode) {
        return JSON.stringify({ found: false, symbolName: args.symbolName, message: 'Symbol declaration not found.' });
      }

      const referencedSymbols = declarationNode.findReferencesAsNodes();

      for (const ref of referencedSymbols) {
        const sf = ref.getSourceFile();
        const lineText = sf.getFullText().split('\n')[ref.getStartLineNumber() - 1] ?? '';
        const preview = lineText.trim().slice(0, 80);

        results.push({
          filePath: sf.getFilePath(),
          line: ref.getStartLineNumber(),
          preview,
        });
      }

      return JSON.stringify({ found: true, count: results.length, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
