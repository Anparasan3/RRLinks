import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseRoutesConfig } from "./routeConfigParser";
import { normalizeSegments } from "./routeMatching";
import { resolveExistingFile } from "./fileResolution";

export interface ResolvedRoute {
  segments: string[];
  file: string;
}

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
  // ponytail: cache the located path per workspace so repeat lookups are
  // free; re-search only if the cached path stops existing (renamed/deleted).
  private readonly routesFileLocationCache = new Map<string, string | null>();
  // ponytail: cache keyed by workspace + routes file mtime, no file watcher —
  // re-parsing on a changed-mtime read is cheap and this file is small.
  private readonly routeMapCache = new Map<string, RouteMapCacheEntry>();

  async getRouteMap(workspaceFolder: vscode.WorkspaceFolder, fileNames: readonly string[]): Promise<ResolvedRoute[]> {
    const routesFsPath = await this.locateRoutesFile(workspaceFolder, fileNames);
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

    const entries: ResolvedRoute[] = [];
    for (const { pattern, file } of parseRoutesConfig(source)) {
      const target = this.resolveRouteFileTarget(routesFsPath, workspaceFolder, file);
      if (!target) continue;
      entries.push({ segments: normalizeSegments(pattern), file: target });
    }

    this.routeMapCache.set(key, { routesFsPath, mtimeMs, entries });
    return entries;
  }

  private async locateRoutesFile(
    workspaceFolder: vscode.WorkspaceFolder,
    fileNames: readonly string[]
  ): Promise<string | null> {
    const key = workspaceFolder.uri.toString();
    const cached = this.routesFileLocationCache.get(key);
    if (cached && fs.existsSync(cached)) return cached;

    for (const dir of ["app", "src/app", "src", "."]) {
      for (const name of fileNames) {
        const candidate = path.join(workspaceFolder.uri.fsPath, dir, name);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          this.routesFileLocationCache.set(key, candidate);
          return candidate;
        }
      }
    }

    // Fallback for unconventional layouts: search the whole workspace folder.
    const pattern = new vscode.RelativePattern(workspaceFolder, `**/{${fileNames.join(",")}}`);
    const found = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 1);
    const result = found[0] ? found[0].fsPath : null;
    this.routesFileLocationCache.set(key, result);
    return result;
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
