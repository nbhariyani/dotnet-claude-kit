import { DiagnosticCategory } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface DiagnosticResult {
  filePath: string;
  line: number;
  message: string;
  code: number;
  category: 'error' | 'warning' | 'suggestion' | 'message';
}

const CATEGORY_MAP: Record<DiagnosticCategory, DiagnosticResult['category']> = {
  [DiagnosticCategory.Error]: 'error',
  [DiagnosticCategory.Warning]: 'warning',
  [DiagnosticCategory.Suggestion]: 'suggestion',
  [DiagnosticCategory.Message]: 'message',
};

export const GetDiagnosticsTool = {
  definition: {
    name: 'get_diagnostics',
    description: 'Get TypeScript compiler diagnostics for a file or the entire project.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Optional: restrict diagnostics to a specific file. Omit for project-wide diagnostics.',
        },
      },
      required: [],
    },
  },

  async execute(args: { filePath?: string }, pm: ProjectManager): Promise<string> {
    const status = pm.ensureLoaded();
    if (status.status !== 'ready') {
      return JSON.stringify({ status: status.status, message: (status as any).message ?? 'Project is loading.' });
    }

    try {
      const project = pm.getProject();
      const results: DiagnosticResult[] = [];

      let diagnostics: import('ts-morph').Diagnostic<import('typescript').Diagnostic>[];

      if (args.filePath) {
        const normalizedInput = args.filePath.replace(/\\/g, '/');
        const sourceFile = project.getSourceFiles().find((sf) => {
          const fp = sf.getFilePath().replace(/\\/g, '/');
          return fp === normalizedInput || fp.endsWith('/' + normalizedInput);
        });

        if (!sourceFile) {
          return JSON.stringify({ error: `File not found in project: ${args.filePath}` });
        }

        diagnostics = sourceFile.getPreEmitDiagnostics();
      } else {
        diagnostics = project.getPreEmitDiagnostics();
      }

      for (const diag of diagnostics) {
        const sourceFile = diag.getSourceFile();
        if (!sourceFile) continue;

        const start = diag.getStart();
        const line = start != null ? sourceFile.getLineAndColumnAtPos(start).line : 0;

        results.push({
          filePath: sourceFile.getFilePath(),
          line,
          message: diag.getMessageText() as string,
          code: diag.getCode(),
          category: CATEGORY_MAP[diag.getCategory()] ?? 'message',
        });
      }

      const summary = {
        total: results.length,
        errors: results.filter((r) => r.category === 'error').length,
        warnings: results.filter((r) => r.category === 'warning').length,
      };

      return JSON.stringify({ summary, diagnostics: results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
