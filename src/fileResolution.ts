import * as fs from "fs";
import * as path from "path";

/** True when `file` is somewhere below `dir`. */
export function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * The project folder a file belongs to: the nearest ancestor (up to and
 * including `stopAt`) holding a package.json, else `stopAt` itself.
 */
export function findProjectRoot(fromFile: string, stopAt: string): string {
  let dir = path.dirname(fromFile);
  while (isInside(dir, stopAt) || dir === stopAt) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (dir === stopAt) break;
    dir = path.dirname(dir);
  }
  return stopAt;
}

/**
 * Returns the first candidate that exists as a real file, or null.
 * Shared by anything that needs to try several base-directory guesses for a
 * relative path (routes.ts file-links, and the resolved route module files).
 */
export function resolveExistingFile(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* ignore fs errors, try next candidate */
    }
  }
  return null;
}
