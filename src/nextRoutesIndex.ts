import * as vscode from "vscode";
import * as path from "path";
import type { ResolvedRoute } from "./routesIndex";
import { appRouterSegments, pagesRouterSegments, compareSpecificity } from "./nextjsRoutes";

const NEXT_CONFIG_GLOB = "**/next.config.{js,mjs,cjs,ts,mts}";
const EXCLUDE_GLOB = "**/node_modules/**";
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

  invalidate(): void {
    this.rootsCache.clear();
    this.routesCache.clear();
  }

  /** Routes of every Next.js app in the folder; the app containing
   * `documentFsPath` comes first so its routes win on a tie. */
  async getRouteMap(workspaceFolder: vscode.WorkspaceFolder, documentFsPath: string): Promise<ResolvedRoute[]> {
    const roots = await this.findNextRoots(workspaceFolder);
    if (!roots.length) return [];

    const ordered = [...roots].sort(
      (a, b) => Number(isInside(documentFsPath, b)) - Number(isInside(documentFsPath, a)) || b.length - a.length
    );
    const perRoot = await Promise.all(ordered.map((root) => this.routesForRoot(root)));
    return perRoot.flat();
  }

  private async findNextRoots(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
    const key = workspaceFolder.uri.toString();
    const cached = this.rootsCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const configs = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, NEXT_CONFIG_GLOB),
      EXCLUDE_GLOB,
      50
    );
    const roots = [...new Set(configs.map((uri) => path.dirname(uri.fsPath)))];
    this.rootsCache.set(key, { at: Date.now(), value: roots });
    return roots;
  }

  private async routesForRoot(root: string): Promise<ResolvedRoute[]> {
    const cached = this.routesCache.get(root);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const scans: Array<[string, string, (rel: string) => string[] | null]> = [
      ["app", "**/{route,page}.{ts,tsx,js,jsx}", appRouterSegments],
      ["src/app", "**/{route,page}.{ts,tsx,js,jsx}", appRouterSegments],
      ["pages", "**/*.{ts,tsx,js,jsx}", pagesRouterSegments],
      ["src/pages", "**/*.{ts,tsx,js,jsx}", pagesRouterSegments],
    ];

    const results = await Promise.all(
      scans.map(async ([dir, glob, toSegments]) => {
        const base = path.join(root, dir);
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(base, glob), EXCLUDE_GLOB);
        const entries: ResolvedRoute[] = [];
        for (const uri of files) {
          const segments = toSegments(path.relative(base, uri.fsPath));
          if (segments) entries.push({ segments, file: uri.fsPath });
        }
        return entries;
      })
    );

    const entries = results.flat().sort((a, b) => compareSpecificity(a.segments, b.segments));
    this.routesCache.set(root, { at: Date.now(), value: entries });
    return entries;
  }
}

function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
