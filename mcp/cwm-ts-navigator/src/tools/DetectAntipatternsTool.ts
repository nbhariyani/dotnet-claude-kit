import { SyntaxKind } from 'ts-morph';
import { ProjectManager } from '../ProjectManager.js';

interface AntipatternResult {
  type: string;
  filePath: string;
  line: number;
  preview: string;
  severity: 'error' | 'warning';
}

type AntipatternCheck = {
  id: string;
  severity: 'error' | 'warning';
  test: (line: string, filePath: string, lineIndex: number) => boolean;
  message: (line: string) => string;
};

const REGEX_CHECKS: AntipatternCheck[] = [
  {
    id: 'console-log',
    severity: 'warning',
    test: (line, fp) => /console\.(log|error|warn|debug)\(/.test(line) && !fp.includes('.spec.') && !fp.includes('.test.'),
    message: () => 'console.log/error/warn/debug — use nestjs-pino logger instead',
  },
  {
    id: 'typeorm-synchronize',
    severity: 'error',
    test: (line) => /synchronize\s*:\s*true/.test(line),
    message: () => 'synchronize: true — destroys data in production; use migrations instead',
  },
  {
    id: 'process-env-direct',
    severity: 'warning',
    test: (line, fp) => /process\.env\.[A-Z_]+/.test(line) && !fp.includes('.spec.') && !fp.includes('main.ts'),
    message: (line) => `Direct process.env access — use ConfigService.getOrThrow() instead`,
  },
  {
    id: 'new-service-instantiation',
    severity: 'error',
    test: (line, fp) => /new\s+[A-Z][a-zA-Z]*Service\s*\(/.test(line) && !fp.includes('.spec.') && !fp.includes('.test.'),
    message: (line) => 'Manual service instantiation bypasses NestJS DI — inject via constructor instead',
  },
  {
    id: 'sync-file-io',
    severity: 'warning',
    test: (line, fp) => /\b(readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|execSync|spawnSync)\b/.test(line) && !fp.includes('scripts/') && !fp.includes('.spec.'),
    message: (line) => 'Synchronous I/O blocks the event loop — use async fs.promises or child_process alternatives',
  },
  {
    id: 'then-without-await',
    severity: 'warning',
    test: (line) => /[^/]\.\bthen\s*\(/.test(line) && !/\/\//.test(line.trim().slice(0, 2)),
    message: () => '.then() chain — prefer async/await for consistency and error propagation',
  },
  {
    id: 'cross-module-service-import',
    severity: 'error',
    test: (line, fp) => {
      const match = line.match(/from\s+['"](\.\.\/([\w-]+)\/([\w-]+\.service))['"]/);
      if (!match) return false;
      // If importing a service from a sibling module directory (../../other-module/other.service)
      const importedModule = match[2];
      const currentModule = fp.split('/').slice(-2, -1)[0];
      return importedModule !== currentModule;
    },
    message: (line) => 'Direct cross-module service import — import the module in @Module imports[] and inject the service via DI',
  },
];

function checkMissingApiProperty(pm: ProjectManager, results: AntipatternResult[]): void {
  const status = pm.ensureLoaded();
  if (status.status !== 'ready') return;

  const project = pm.getProject();

  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath();
    if (!fp.includes('.dto.') && !fp.toLowerCase().includes('dto')) continue;
    if (fp.includes('.spec.') || fp.includes('.test.')) continue;

    const classes = sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration);
    for (const cls of classes) {
      const props = cls.getProperties();
      for (const prop of props) {
        const decorators = prop.getDecorators().map((d) => d.getName());
        if (!decorators.includes('ApiProperty') && !decorators.includes('ApiPropertyOptional') && !decorators.includes('ApiHideProperty')) {
          const lineText = prop.getText().trim().slice(0, 80);
          results.push({
            type: 'missing-api-property',
            filePath: fp,
            line: prop.getStartLineNumber(),
            preview: lineText,
            severity: 'warning',
          });
        }
      }
    }
  }
}

export const DetectAntipatternsTool = {
  definition: {
    name: 'detect_antipatterns',
    description: 'Scan for NestJS-specific antipatterns: console.log, synchronize:true, missing @ApiProperty, cross-module imports, direct process.env, new SomeService(), sync I/O, and .then() chains.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: 'Optional: restrict scan to a specific directory.',
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
      const results: AntipatternResult[] = [];

      const sourceFiles = project.getSourceFiles().filter((sf) => {
        const fp = sf.getFilePath().replace(/\\/g, '/');
        if (args.directory) return fp.includes(args.directory.replace(/\\/g, '/'));
        return true;
      });

      // Regex-based line checks
      for (const sf of sourceFiles) {
        const filePath = sf.getFilePath();
        const lines = sf.getFullText().split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const check of REGEX_CHECKS) {
            if (check.test(line, filePath, i)) {
              results.push({
                type: check.id,
                filePath,
                line: i + 1,
                preview: line.trim().slice(0, 80),
                severity: check.severity,
              });
            }
          }
        }
      }

      // AST-based checks
      checkMissingApiProperty(pm, results);

      const summary = {
        total: results.length,
        errors: results.filter((r) => r.severity === 'error').length,
        warnings: results.filter((r) => r.severity === 'warning').length,
        byType: results.reduce<Record<string, number>>((acc, r) => {
          acc[r.type] = (acc[r.type] ?? 0) + 1;
          return acc;
        }, {}),
      };

      return JSON.stringify({ summary, results });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
