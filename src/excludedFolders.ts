import * as path from "path";

/**
 * Folders that never hold hand-written route code: dependencies, build
 * output, framework-generated files and caches. Files inside them get no
 * links, and they're left out of every file search, so a compiled
 * build/routes.js or a generated .react-router/ copy is never mistaken for
 * the real source. Pure and vscode-free.
 */
export const DEFAULT_EXCLUDED_FOLDERS = [
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".react-router",
  ".turbo",
  ".vercel",
  ".output",
  ".cache",
  "coverage",
  ".git",
];

// Folder names only: anything with glob or path characters is ignored so a
// setting can't break the search pattern.
const SAFE_NAME = /^[\w.@-]+$/;

function safeNames(folders: readonly string[]): string[] {
  return [...new Set(folders.map((f) => f.trim()).filter((f) => SAFE_NAME.test(f)))];
}

/** Glob for vscode.workspace.findFiles' exclude argument. */
export function excludeGlob(folders: readonly string[]): string {
  const names = safeNames(folders);
  if (!names.length) return "**/node_modules/**";
  return names.length === 1 ? `**/${names[0]}/**` : `**/{${names.join(",")}}/**`;
}

/**
 * True when `filePath` sits inside an excluded folder below `workspaceRoot`.
 * Only folders *inside* the workspace count, so a workspace that itself
 * lives under e.g. ~/build/ still works.
 */
export function isInExcludedFolder(filePath: string, workspaceRoot: string, folders: readonly string[]): boolean {
  const rel = path.relative(workspaceRoot, filePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const names = new Set(safeNames(folders));
  const dirs = rel.split(/[\\/]/).slice(0, -1); // folders only, not the file name
  return dirs.some((d) => names.has(d));
}
