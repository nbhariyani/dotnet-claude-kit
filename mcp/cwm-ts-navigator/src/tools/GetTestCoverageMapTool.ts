import { ProjectManager } from '../ProjectManager.js';
import fs from 'fs';
import path from 'path';

interface TestCoverageMap {
  covered: string[];
  uncovered: string[];
}

export const GetTestCoverageMapTool = {
  definition: {
    name: 'get_test_coverage_map',
    description: 'Check which source files have corresponding .spec.ts or .e2e-spec.ts test files.',
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
      const result: TestCoverageMap = { covered: [], uncovered: [] };

      const sourceFiles = project.getSourceFiles().filter((sf) => {
        const fp = sf.getFilePath().replace(/\\/g, '/');

        // Skip test files themselves
        if (fp.includes('.spec.') || fp.includes('.test.') || fp.includes('.e2e-spec.')) return false;
        // Skip declaration files
        if (fp.endsWith('.d.ts')) return false;

        if (args.directory) {
          return fp.includes(args.directory.replace(/\\/g, '/'));
        }
        return true;
      });

      for (const sf of sourceFiles) {
        const filePath = sf.getFilePath();
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, '.ts');

        const specPath = path.join(dir, `${base}.spec.ts`);
        const e2eSpecPath = path.join(dir, `${base}.e2e-spec.ts`);

        const hasSpec = fs.existsSync(specPath) || fs.existsSync(e2eSpecPath);

        if (hasSpec) {
          result.covered.push(filePath);
        } else {
          result.uncovered.push(filePath);
        }
      }

      const summary = {
        total: result.covered.length + result.uncovered.length,
        covered: result.covered.length,
        uncovered: result.uncovered.length,
        coveragePercent:
          result.covered.length + result.uncovered.length > 0
            ? Math.round((result.covered.length / (result.covered.length + result.uncovered.length)) * 100)
            : 0,
      };

      return JSON.stringify({ summary, covered: result.covered, uncovered: result.uncovered });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
