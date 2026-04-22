import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface DeadCodeResult {
  name: string;
  kind: string;
  filePath: string;
  line: number;
}

const EXPORTED_KINDS = [
  SyntaxKind.ClassDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.VariableStatement,
] as const;

const KIND_LABELS: Partial<Record<SyntaxKind, string>> = {
  [SyntaxKind.ClassDeclaration]: 'class',
  [SyntaxKind.InterfaceDeclaration]: 'interface',
  [SyntaxKind.FunctionDeclaration]: 'function',
  [SyntaxKind.EnumDeclaration]: 'enum',
  [SyntaxKind.TypeAliasDeclaration]: 'type',
  [SyntaxKind.VariableStatement]: 'variable',
};

export const FindDeadCodeTool = {
  definition: {
    name: 'find_dead_code',
    description: 'Find exported symbols with zero references across the project (potential dead code).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: 'Optional: restrict scan to a specific directory path.',
        },
      },
      required: [],
    },
  },

  async execute(args: { directory?: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const results: DeadCodeResult[] = [];

      const sourceFiles = project.getSourceFiles().filter((sf) => {
        if (!args.directory) return true;
        return sf.getFilePath().includes(args.directory.replace(/\\/g, '/'));
      });

      for (const sf of sourceFiles) {
        // Skip test files — dead code detection in tests is noisy
        if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) continue;

        for (const kind of EXPORTED_KINDS) {
          const nodes = sf.getDescendantsOfKind(kind);
          for (const node of nodes) {
            // Check if exported
            const isExported =
              (node as any).isExported?.() ??
              node.getModifiers?.()?.some((m) => m.getKind() === SyntaxKind.ExportKeyword) ??
              false;

            if (!isExported) continue;

            let name: string | undefined;
            let nameNode: import('ts-morph').Node | undefined;

            if (kind === SyntaxKind.VariableStatement) {
              const decls = (node as import('ts-morph').VariableStatement).getDeclarations();
              if (decls.length === 0) continue;
              name = decls[0].getName();
              nameNode = decls[0].getNameNode();
            } else {
              name = (node as any).getName?.();
              nameNode = (node as any).getNameNode?.();
            }

            if (!name || !nameNode) continue;

            const refs = (nameNode as any).findReferencesAsNodes() as import('ts-morph').Node[];
            // Filter out self-reference (the declaration itself)
            const externalRefs = refs.filter((r) => r !== nameNode && r.getSourceFile() !== sf || r.getSourceFile() === sf && r.getStartLineNumber() !== nameNode!.getStartLineNumber());

            if (externalRefs.length === 0) {
              results.push({
                name,
                kind: KIND_LABELS[kind] ?? 'unknown',
                filePath: sf.getFilePath(),
                line: node.getStartLineNumber(),
              });
            }
          }
        }
      }

      return JSON.stringify({ count: results.length, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
