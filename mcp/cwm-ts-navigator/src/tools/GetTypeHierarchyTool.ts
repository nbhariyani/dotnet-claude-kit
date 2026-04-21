import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface TypeHierarchyResult {
  class: string;
  extends: string | null;
  implements: string[];
  implementedBy: string[];
}

export const GetTypeHierarchyTool = {
  definition: {
    name: 'get_type_hierarchy',
    description: 'Get the full type hierarchy for a class: what it extends, what it implements, and which classes implement or extend it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        className: {
          type: 'string',
          description: 'The class name to get the hierarchy for.',
        },
      },
      required: ['className'],
    },
  },

  async execute(args: { className: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();

      // Find the target class declaration
      let targetClass: import('ts-morph').ClassDeclaration | undefined;
      for (const sf of project.getSourceFiles()) {
        const cls = sf.getClass(args.className);
        if (cls) {
          targetClass = cls;
          break;
        }
      }

      if (!targetClass) {
        return JSON.stringify({ found: false, className: args.className });
      }

      const extendsClause = targetClass.getExtends();
      const extendsName = extendsClause ? extendsClause.getExpression().getText() : null;
      const implementsNames = targetClass.getImplements().map((i) => i.getExpression().getText());

      // Find classes that implement or extend this class
      const implementedBy: string[] = [];
      for (const sf of project.getSourceFiles()) {
        const classes = sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration);
        for (const cls of classes) {
          if (cls === targetClass) continue;
          const name = cls.getName();
          if (!name) continue;

          const clsExtends = cls.getExtends()?.getExpression().getText();
          const clsImplements = cls.getImplements().map((i) => i.getExpression().getText());

          if (clsExtends === args.className || clsImplements.includes(args.className)) {
            implementedBy.push(name);
          }
        }
      }

      const result: TypeHierarchyResult = {
        class: args.className,
        extends: extendsName,
        implements: implementsNames,
        implementedBy,
      };

      return JSON.stringify({ found: true, result });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
