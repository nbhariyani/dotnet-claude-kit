import { Node, SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

type SymbolKind = 'class' | 'interface' | 'function' | 'enum' | 'type';

interface SymbolResult {
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
}

const KIND_MAP: Record<SymbolKind, SyntaxKind[]> = {
  class: [SyntaxKind.ClassDeclaration],
  interface: [SyntaxKind.InterfaceDeclaration],
  function: [SyntaxKind.FunctionDeclaration],
  enum: [SyntaxKind.EnumDeclaration],
  type: [SyntaxKind.TypeAliasDeclaration],
};

export const FindSymbolTool = {
  definition: {
    name: 'find_symbol',
    description:
      'Find where a TypeScript symbol (class, interface, function, enum, or type alias) is declared. Returns file paths and line numbers only — never full source.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbolName: {
          type: 'string',
          description: 'The exact name of the symbol to find.',
        },
        kind: {
          type: 'string',
          enum: ['class', 'interface', 'function', 'enum', 'type'],
          description: 'Optional: restrict results to a specific declaration kind.',
        },
      },
      required: ['symbolName'],
    },
  },

  async execute(args: { symbolName: string; kind?: SymbolKind }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading, try again shortly.' });
    }

    try {
      const project = pm.getProject();
      const results: SymbolResult[] = [];
      const targetKinds = args.kind ? KIND_MAP[args.kind] : Object.values(KIND_MAP).flat();

      for (const sourceFile of project.getSourceFiles()) {
        const filePath = sourceFile.getFilePath();

        for (const [kind, syntaxKinds] of Object.entries(KIND_MAP) as [SymbolKind, SyntaxKind[]][]) {
          if (args.kind && args.kind !== kind) continue;

          for (const syntaxKind of syntaxKinds) {
            const declarations = sourceFile.getDescendantsOfKind(syntaxKind);
            for (const decl of declarations) {
              const nameNode = (decl as any).getNameNode?.();
              const name: string = nameNode ? nameNode.getText() : '';
              if (name === args.symbolName) {
                results.push({
                  name,
                  kind,
                  filePath,
                  line: decl.getStartLineNumber(),
                });
              }
            }
          }
        }
      }

      if (results.length === 0) {
        return JSON.stringify({ found: false, symbolName: args.symbolName });
      }

      return JSON.stringify({ found: true, count: results.length, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
