import * as vscode from "vscode";
import * as path from "path";
import type { ResolvedRoute } from "./routesIndex";
import { appRouterSegments, pagesRouterSegments, compareSpecificity } from "./nextjsRoutes";
import { isInside } from "./fileResolution";
import { excludeGlob } from "./excludedFolders";

const NEXT_CONFIG_GLOB = "**/next.config.{js,mjs,cjs,ts,mts}";
// ponytail: no file watcher. Results are reused for a short window and
// dropped early when files are created/deleted/renamed inside VS Code
// (see extension.ts); anything changed outside VS Code is picked up once
// the window expires.
const CACHE_TTL_MS = 30_000;

interface Cached<T> {
  at: number;
  value: T;
}

/**
 * Builds a route map from a Next.js project's file system: App Router
 * `route.*` / `page.*` files and Pages Router files. A folder counts as a
 * Next.js project only when it has a next.config.* file, so React Router
 * projects (which also use an `app/` dir) are never scanned this way.
 * Monorepos with several Next.js apps are supported.
 */
export class NextRoutesIndex {
  private readonly rootsCache = new Map<string, Cached<string[]>>();
  private readonly routesCache = new Map<string, Cached<ResolvedRoute[]>>();
  // Concurrent requests share one in-flight scan instead of each starting one.
  private readonly pending = new Map<string, Promise<unknown>>();
  private generation = 0;

  invalidate(): void {
    this.generation++;
    this.rootsCache.clear();
    this.routesCache.clear();
  }

  /** Returns the cached value if fresh, else runs `scan` once (shared by
   * concurrent callers) and caches it unless invalidated meanwhile. */
  private cached<T>(kind: string, cache: Map<string, Cached<T>>, key: string, scan: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.value);

    const pendingKey = `${kind}|${key}`;
    const inFlight = this.pending.get(pendingKey) as Promise<T> | undefined;
    if (inFlight) return inFlight;

    const generation = this.generation;
    const promise = scan()
      .then((value) => {
        if (generation === this.generation) cache.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(pendingKey));
    this.pending.set(pendingKey, promise);
    return promise;
  }

  /** Routes of every Next.js app in the folder; the app containing
   * `documentFsPath` comes first so its routes win on a tie. */
  async getRouteMap(
    workspaceFolder: vscode.WorkspaceFolder,
    documentFsPath: string,
    excludeFolders: readonly string[]
  ): Promise<ResolvedRoute[]> {
    // The extension clears this cache when the setting changes (extension.ts).
    const exclude = excludeGlob(excludeFolders);
    const roots = await this.findNextRoots(workspaceFolder, exclude);
    if (!roots.length) return [];

    const ordered = [...roots].sort(
      (a, b) => Number(isInside(documentFsPath, b)) - Number(isInside(documentFsPath, a)) || b.length - a.length
    );
    const perRoot = await Promise.all(ordered.map((root) => this.routesForRoot(root, exclude)));
    return perRoot.flat();
  }

  private findNextRoots(workspaceFolder: vscode.WorkspaceFolder, exclude: string): Promise<string[]> {
    return this.cached("roots", this.rootsCache, workspaceFolder.uri.toString(), async () => {
      const configs = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, NEXT_CONFIG_GLOB),
        exclude,
        50
      );
      return [...new Set(configs.map((uri) => path.dirname(uri.fsPath)))];
    });
  }

  private routesForRoot(root: string, exclude: string): Promise<ResolvedRoute[]> {
    return this.cached("routes", this.routesCache, root, () => this.scanRoot(root, exclude));
  }

  private async scanRoot(root: string, exclude: string): Promise<ResolvedRoute[]> {
    const scans: Array<[string, string, (rel: string) => string[] | null]> = [
      ["app", "**/{route,page}.{ts,tsx,js,jsx}", appRouterSegments],
      ["src/app", "**/{route,page}.{ts,tsx,js,jsx}", appRouterSegments],
      ["pages", "**/*.{ts,tsx,js,jsx}", pagesRouterSegments],
      ["src/pages", "**/*.{ts,tsx,js,jsx}", pagesRouterSegments],
    ];

    const results = await Promise.all(
      scans.map(async ([dir, glob, toSegments]) => {
        const base = path.join(root, dir);
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(base, glob), exclude);
        const entries: ResolvedRoute[] = [];
        for (const uri of files) {
          const segments = toSegments(path.relative(base, uri.fsPath));
          if (segments) entries.push({ segments, file: uri.fsPath, root });
        }
        return entries;
      })
    );

    return results.flat().sort((a, b) => compareSpecificity(a.segments, b.segments));
  }
}

