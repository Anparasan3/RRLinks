import * as fs from "fs";

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
