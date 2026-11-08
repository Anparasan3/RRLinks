import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseRoutesConfig } from "./routeConfigParser";
import { normalizeSegments } from "./routeMatching";
import { resolveExistingFile, findProjectRoot } from "./fileResolution";
import { excludeGlob } from "./excludedFolders";

export interface ResolvedRoute {
  segments: string[];
  file: string;
  /** Project folder the route belongs to; a document inside it prefers
   * this route over an identical path from another app in the workspace. */
  root?: string;
}

const LOCATE_RETRY_MS = 30_000;

interface RouteMapCacheEntry {
  routesFsPath: string;
  mtimeMs: number;
  entries: ResolvedRoute[];
}

/**
 * Locates, parses, and caches a workspace's routes.ts config, exposing it as
 * a flat list of resolved route patterns -> module file paths.
 *
 * One instance is shared for the extension's lifetime (see extension.ts);
 * each workspace folder gets its own cache entry.
 */
export class RoutesIndex {
  // ponytail: cache the located path per workspace + configured file names so
  // repeat lookups are free. A found path is reused until it stops existing;
  // "not found" (any non-React-Router project) is reused for
  // LOCATE_RETRY_MS, so link requests never trigger a workspace search
  // per keystroke. invalidate() drops it early when files change in VS Code.
  private readonly routesFileLocationCache = new Map<string, { path: string | null; at: number }>();
  private readonly pendingLocate = new Map<string, Promise<string | null>>();
  private generation = 0;
  // ponytail: cache keyed by workspace + routes file mtime, no file watcher —
  // re-parsing on a changed-mtime read is cheap and this file is small.
  private readonly routeMapCache = new Map<string, RouteMapCacheEntry>();

  async getRouteMap(
    workspaceFolder: vscode.WorkspaceFolder,
    fileNames: readonly string[],
    excludeFolders: readonly string[]
  ): Promise<ResolvedRoute[]> {
    const routesFsPath = await this.locateRoutesFile(workspaceFolder, fileNames, excludeFolders);
    if (!routesFsPath) return [];

    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(routesFsPath).mtimeMs;
    } catch {
      return [];
    }

    const key = workspaceFolder.uri.toString();
    const cached = this.routeMapCache.get(key);
    if (cached && cached.routesFsPath === routesFsPath && cached.mtimeMs === mtimeMs) {
      return cached.entries;
    }

    let source: string;
    try {
      source = fs.readFileSync(routesFsPath, "utf8");
    } catch {
      return [];
    }

    const root = findProjectRoot(routesFsPath, workspaceFolder.uri.fsPath);
    const entries: ResolvedRoute[] = [];
    for (const { pattern, file } of parseRoutesConfig(source)) {
      const target = this.resolveRouteFileTarget(routesFsPath, workspaceFolder, file);
      if (!target) continue;
      entries.push({ segments: normalizeSegments(pattern), file: target, root });
    }

    this.routeMapCache.set(key, { routesFsPath, mtimeMs, entries });
    return entries;
  }

  /** Forget located routes files, e.g. after files are created or renamed. */
  invalidate(): void {
    this.generation++;
    this.routesFileLocationCache.clear();
  }

  private locateRoutesFile(
    workspaceFolder: vscode.WorkspaceFolder,
    fileNames: readonly string[],
    excludeFolders: readonly string[]
  ): Promise<string | null> {
    const key = `${workspaceFolder.uri.toString()}|${fileNames.join(",")}|${excludeFolders.join(",")}`;
    const cached = this.routesFileLocationCache.get(key);
    if (cached) {
      const fresh = cached.path ? fs.existsSync(cached.path) : Date.now() - cached.at < LOCATE_RETRY_MS;
      if (fresh) return Promise.resolve(cached.path);
    }

    // Concurrent requests share one search instead of each starting their own.
    let pending = this.pendingLocate.get(key);
    if (!pending) {
      const generation = this.generation;
      pending = this.searchRoutesFile(workspaceFolder, fileNames, excludeFolders)
        .then((found) => {
          if (generation === this.generation) this.routesFileLocationCache.set(key, { path: found, at: Date.now() });
          return found;
        })
        .finally(() => this.pendingLocate.delete(key));
      this.pendingLocate.set(key, pending);
    }
    return pending;
  }

  private async searchRoutesFile(
    workspaceFolder: vscode.WorkspaceFolder,
    fileNames: readonly string[],
    excludeFolders: readonly string[]
  ): Promise<string | null> {
    for (const dir of ["app", "src/app", "src", "."]) {
      for (const name of fileNames) {
        const candidate = path.join(workspaceFolder.uri.fsPath, dir, name);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
    }

    // Fallback for unconventional layouts: search the whole workspace folder.
    const pattern = new vscode.RelativePattern(workspaceFolder, `**/{${fileNames.join(",")}}`);
    const found = await vscode.workspace.findFiles(pattern, excludeGlob(excludeFolders), 1);
    return found[0] ? found[0].fsPath : null;
  }

  private resolveRouteFileTarget(
    routesFsPath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    fileValue: string
  ): string | null {
    return resolveExistingFile([
      path.resolve(path.dirname(routesFsPath), fileValue),
      path.resolve(workspaceFolder.uri.fsPath, fileValue),
      path.resolve(workspaceFolder.uri.fsPath, "app", fileValue),
      path.resolve(workspaceFolder.uri.fsPath, "src/app", fileValue),
      path.resolve(workspaceFolder.uri.fsPath, "src", fileValue),
    ]);
  }
}
