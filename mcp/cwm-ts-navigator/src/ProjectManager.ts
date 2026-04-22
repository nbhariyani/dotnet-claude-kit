import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';

export type LoadStatus = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export class ProjectManager {
  private project: Project | null = null;
  private loadStatus: LoadStatus = { status: 'loading' };
  private readonly tsconfigPath: string;

  constructor(tsconfigPath?: string) {
    this.tsconfigPath = tsconfigPath ?? this.findTsconfig();
    this.initialize();
  }

  private findTsconfig(): string {
    let dir = process.env['workspaceFolder'] ?? process.cwd();
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // Return a default path — initialize() will handle the missing file gracefully
    return path.join(process.env['workspaceFolder'] ?? process.cwd(), 'tsconfig.json');
  }

  private initialize(): void {
    // Run async initialization without blocking constructor
    setImmediate(() => this.load());
  }

  private async load(): Promise<void> {
    try {
      if (!fs.existsSync(this.tsconfigPath)) {
        this.loadStatus = {
          status: 'error',
          message: `tsconfig.json not found at: ${this.tsconfigPath}`,
        };
        return;
      }

      this.project = new Project({
        tsConfigFilePath: this.tsconfigPath,
        skipAddingFilesFromTsConfig: false,
      });

      // Force load source files
      this.project.getSourceFiles();
      this.loadStatus = { status: 'ready' };
    } catch (err) {
      this.loadStatus = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Returns loading status. Callers should check this before calling getProject(). */
  ensureLoaded(): LoadStatus {
    return this.loadStatus;
  }

  /** Returns the loaded Project. Throws if not yet initialized or errored. */
  getProject(): Project {
    if (this.loadStatus.status !== 'ready' || !this.project) {
      throw new Error(`Project not ready: ${JSON.stringify(this.loadStatus)}`);
    }
    return this.project;
  }

  /** Reload project from disk (e.g. after file changes). */
  async refresh(): Promise<void> {
    this.loadStatus = { status: 'loading' };
    this.project = null;
    await this.load();
  }

  getTsconfigPath(): string {
    return this.tsconfigPath;
  }
}
