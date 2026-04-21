import { Scope } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface PublicApiEntry {
  name: string;
  kind: string;
  signature: string;
}

export const GetPublicApiTool = {
  definition: {
    name: 'get_public_api',
    description: 'List all public exported symbols from a file with their signatures. Returns signatures only — no function bodies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the TypeScript file.',
        },
      },
      required: ['filePath'],
    },
  },

  async execute(args: { filePath: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();

      const normalizedInput = args.filePath.replace(/\\/g, '/');
      const sourceFile = project.getSourceFiles().find((sf) => {
        const fp = sf.getFilePath().replace(/\\/g, '/');
        return fp === normalizedInput || fp.endsWith('/' + normalizedInput);
      });

      if (!sourceFile) {
        return JSON.stringify({ error: `File not found in project: ${args.filePath}` });
      }

      const entries: PublicApiEntry[] = [];

      // Exported classes
      for (const cls of sourceFile.getClasses()) {
        if (!cls.isExported()) continue;
        const name = cls.getName() ?? '<anonymous>';
        const extendsStr = cls.getExtends() ? ` extends ${cls.getExtends()!.getExpression().getText()}` : '';
        const implStr = cls.getImplements().length > 0
          ? ` implements ${cls.getImplements().map((i) => i.getExpression().getText()).join(', ')}`
          : '';
        entries.push({ name, kind: 'class', signature: `class ${name}${extendsStr}${implStr}` });

        // Public methods
        for (const method of cls.getMethods()) {
          const scope = method.getScope();
          if (scope !== undefined && scope !== Scope.Public) continue;
          const params = method.getParameters().map((p) => p.getText()).join(', ');
          const returnType = method.getReturnTypeNode()?.getText() ?? '';
          const sig = `${method.isAsync() ? 'async ' : ''}${method.getName()}(${params})${returnType ? `: ${returnType}` : ''}`;
          entries.push({ name: method.getName(), kind: 'method', signature: sig });
        }
      }

      // Exported interfaces
      for (const iface of sourceFile.getInterfaces()) {
        if (!iface.isExported()) continue;
        const name = iface.getName();
        const methods = iface.getMethods().map((m) => {
          const params = m.getParameters().map((p) => p.getText()).join(', ');
          return `  ${m.getName()}(${params}): ${m.getReturnTypeNode()?.getText() ?? 'void'}`;
        });
        const props = iface.getProperties().map((p) => `  ${p.getText()}`);
        entries.push({ name, kind: 'interface', signature: `interface ${name} { ${[...props, ...methods].join('; ')} }` });
      }

      // Exported functions
      for (const fn of sourceFile.getFunctions()) {
        if (!fn.isExported()) continue;
        const name = fn.getName() ?? '<anonymous>';
        const params = fn.getParameters().map((p) => p.getText()).join(', ');
        const returnType = fn.getReturnTypeNode()?.getText() ?? '';
        entries.push({
          name,
          kind: 'function',
          signature: `${fn.isAsync() ? 'async ' : ''}function ${name}(${params})${returnType ? `: ${returnType}` : ''}`,
        });
      }

      // Exported enums
      for (const en of sourceFile.getEnums()) {
        if (!en.isExported()) continue;
        const members = en.getMembers().map((m) => m.getName()).join(', ');
        entries.push({ name: en.getName(), kind: 'enum', signature: `enum ${en.getName()} { ${members} }` });
      }

      // Exported type aliases
      for (const ta of sourceFile.getTypeAliases()) {
        if (!ta.isExported()) continue;
        entries.push({ name: ta.getName(), kind: 'type', signature: `type ${ta.getName()} = ${ta.getTypeNode()?.getText() ?? '?'}` });
      }

      return JSON.stringify({ filePath: sourceFile.getFilePath(), count: entries.length, exports: entries });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
