import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface NestModuleInfo {
  moduleName: string;
  filePath: string;
  imports: string[];
  exports: string[];
  providers: string[];
  controllers: string[];
}

function extractArrayElements(node: import('ts-morph').Node): string[] {
  if (node.getKind() !== SyntaxKind.ArrayLiteralExpression) return [];
  const arr = node as import('ts-morph').ArrayLiteralExpression;
  return arr.getElements().map((el) => {
    // Handle spread expressions, identifiers, property access, call expressions
    const text = el.getText().trim();
    // Unwrap forwardRef(() => X) → X
    const forwardRefMatch = text.match(/forwardRef\s*\(\s*\(\s*\)\s*=>\s*(\w+)\s*\)/);
    if (forwardRefMatch) return forwardRefMatch[1];
    return text;
  });
}

function parseModuleDecorator(cls: import('ts-morph').ClassDeclaration): Omit<NestModuleInfo, 'moduleName' | 'filePath'> {
  const moduleDecorator = cls.getDecorators().find((d) => d.getName() === 'Module');
  const empty = { imports: [], exports: [], providers: [], controllers: [] };

  if (!moduleDecorator) return empty;

  const callExpr = moduleDecorator.getCallExpression();
  if (!callExpr) return empty;

  const args = callExpr.getArguments();
  if (args.length === 0) return empty;

  const config = args[0];
  if (config.getKind() !== SyntaxKind.ObjectLiteralExpression) return empty;

  const obj = config as import('ts-morph').ObjectLiteralExpression;

  function getArray(key: string): string[] {
    const prop = obj.getProperty(key);
    if (!prop) return [];
    const initializer = (prop as import('ts-morph').PropertyAssignment).getInitializer?.();
    if (!initializer) return [];
    return extractArrayElements(initializer);
  }

  return {
    imports: getArray('imports'),
    exports: getArray('exports'),
    providers: getArray('providers'),
    controllers: getArray('controllers'),
  };
}

export const GetModuleGraphTool = {
  definition: {
    name: 'get_module_graph',
    description: 'Parse NestJS @Module() decorators and return the module dependency graph. Omit moduleName for the full project graph.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        moduleName: {
          type: 'string',
          description: 'Optional: return graph for a specific module only.',
        },
      },
      required: [],
    },
  },

  async execute(args: { moduleName?: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const modules: NestModuleInfo[] = [];

      for (const sf of project.getSourceFiles()) {
        const classes = sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration);
        for (const cls of classes) {
          const hasModuleDecorator = cls.getDecorators().some((d) => d.getName() === 'Module');
          if (!hasModuleDecorator) continue;

          const moduleName = cls.getName() ?? '<anonymous>';
          if (args.moduleName && moduleName !== args.moduleName) continue;

          const info = parseModuleDecorator(cls);
          modules.push({
            moduleName,
            filePath: sf.getFilePath(),
            ...info,
          });
        }
      }

      if (modules.length === 0) {
        return JSON.stringify({ found: false, message: args.moduleName ? `Module ${args.moduleName} not found.` : 'No NestJS modules found in project.' });
      }

      return JSON.stringify({ count: modules.length, modules });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
