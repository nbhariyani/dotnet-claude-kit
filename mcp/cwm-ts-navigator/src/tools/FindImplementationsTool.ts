import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface ImplementationResult {
  className: string;
  filePath: string;
  line: number;
}

export const FindImplementationsTool = {
  definition: {
    name: 'find_implementations',
    description: 'Find all classes that implement a given interface.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        interfaceName: {
          type: 'string',
          description: 'The interface name to find implementations of.',
        },
      },
      required: ['interfaceName'],
    },
  },

  async execute(args: { interfaceName: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const results: ImplementationResult[] = [];

      for (const sourceFile of project.getSourceFiles()) {
        const classes = sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration);
        for (const cls of classes) {
          const implementsClauses = cls.getImplements();
          for (const impl of implementsClauses) {
            const typeName = impl.getExpression().getText();
            if (typeName === args.interfaceName) {
              results.push({
                className: cls.getName() ?? '<anonymous>',
                filePath: sourceFile.getFilePath(),
                line: cls.getStartLineNumber(),
              });
            }
          }
        }
      }

      if (results.length === 0) {
        return JSON.stringify({ found: false, interfaceName: args.interfaceName });
      }

      return JSON.stringify({ found: true, count: results.length, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
