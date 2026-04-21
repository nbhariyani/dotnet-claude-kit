import { ProjectManager } from '../ProjectManager.js';

type ImportGraph = Map<string, Set<string>>;

function buildImportGraph(sourceFiles: import('ts-morph').SourceFile[], directoryFilter?: string): ImportGraph {
  const graph: ImportGraph = new Map();
  const normalizedFilter = directoryFilter?.replace(/\\/g, '/');

  for (const sf of sourceFiles) {
    const fp = sf.getFilePath().replace(/\\/g, '/');
    if (normalizedFilter && !fp.includes(normalizedFilter)) continue;
    if (fp.endsWith('.d.ts')) continue;

    if (!graph.has(fp)) graph.set(fp, new Set());

    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      // Only track local imports
      if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) continue;

      const resolvedSf = importDecl.getModuleSpecifierSourceFile();
      if (!resolvedSf) continue;

      const resolvedFp = resolvedSf.getFilePath().replace(/\\/g, '/');
      if (normalizedFilter && !resolvedFp.includes(normalizedFilter)) continue;

      graph.get(fp)!.add(resolvedFp);
    }
  }

  return graph;
}

function detectCycles(graph: ImportGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stackPath: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    inStack.add(node);
    stackPath.push(node);

    const neighbors = graph.get(node) ?? new Set<string>();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Found a cycle — extract the cycle path
        const cycleStart = stackPath.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = [...stackPath.slice(cycleStart), neighbor];
          // Deduplicate: normalize cycle by rotating to smallest element
          const normalized = normalizeCycle(cycle);
          const key = normalized.join('->');
          if (!cycles.some((c) => normalizeCycle(c).join('->') === key)) {
            cycles.push(cycle);
          }
        }
      }
    }

    stackPath.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function normalizeCycle(cycle: string[]): string[] {
  // Remove last element if it duplicates first (closing the loop)
  const c = cycle[cycle.length - 1] === cycle[0] ? cycle.slice(0, -1) : [...cycle];
  if (c.length === 0) return c;
  // Rotate to start with lexicographically smallest element
  const minIdx = c.reduce((minI, val, i) => (val < c[minI] ? i : minI), 0);
  return [...c.slice(minIdx), ...c.slice(0, minIdx)];
}

export const DetectCircularDepsTool = {
  definition: {
    name: 'detect_circular_deps',
    description: 'Detect circular import chains in the project. Returns each cycle as an ordered list of file paths.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        directory: {
          type: 'string',
          description: 'Optional: restrict analysis to a specific directory.',
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
      const sourceFiles = project.getSourceFiles();

      const graph = buildImportGraph(sourceFiles, args.directory);
      const cycles = detectCycles(graph);

      if (cycles.length === 0) {
        return JSON.stringify({ found: false, message: 'No circular dependencies detected.' });
      }

      return JSON.stringify({
        found: true,
        count: cycles.length,
        cycles,
      });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
