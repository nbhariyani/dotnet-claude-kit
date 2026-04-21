import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface CallerResult {
  callerClass: string | null;
  callerMethod: string | null;
  filePath: string;
  line: number;
}

export const FindCallersTool = {
  definition: {
    name: 'find_callers',
    description: 'Find all call sites of a method by name, optionally scoped to a class.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        methodName: {
          type: 'string',
          description: 'The method name to find call sites for.',
        },
        className: {
          type: 'string',
          description: 'Optional: restrict to a method on a specific class.',
        },
      },
      required: ['methodName'],
    },
  },

  async execute(args: { methodName: string; className?: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const results: CallerResult[] = [];

      // Find the method declaration to use findReferencesAsNodes
      let methodNode: import('ts-morph').Node | undefined;

      for (const sf of project.getSourceFiles()) {
        const methods = sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration);
        for (const method of methods) {
          const name = method.getName();
          if (name !== args.methodName) continue;

          if (args.className) {
            const parent = method.getParent();
            if (
              parent.getKind() === SyntaxKind.ClassDeclaration &&
              (parent as import('ts-morph').ClassDeclaration).getName() !== args.className
            ) {
              continue;
            }
          }

          methodNode = method.getNameNode();
          break;
        }
        if (methodNode) break;
      }

      if (!methodNode) {
        return JSON.stringify({ found: false, methodName: args.methodName, message: 'Method declaration not found.' });
      }

      const refs = methodNode.findReferencesAsNodes();

      for (const ref of refs) {
        const sf = ref.getSourceFile();
        // Skip the declaration itself (same position as method name)
        if (ref === methodNode) continue;

        // Walk up to find enclosing class and method
        let callerClass: string | null = null;
        let callerMethod: string | null = null;

        let ancestor = ref.getParent();
        while (ancestor) {
          if (ancestor.getKind() === SyntaxKind.MethodDeclaration) {
            callerMethod = (ancestor as import('ts-morph').MethodDeclaration).getName();
          }
          if (ancestor.getKind() === SyntaxKind.ClassDeclaration) {
            callerClass = (ancestor as import('ts-morph').ClassDeclaration).getName() ?? null;
            break;
          }
          ancestor = ancestor.getParent();
        }

        results.push({
          callerClass,
          callerMethod,
          filePath: sf.getFilePath(),
          line: ref.getStartLineNumber(),
        });
      }

      return JSON.stringify({ found: true, count: results.length, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
