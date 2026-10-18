/**
 * Detecting route-path-looking string literals in source files and matching
 * them against a parsed route pattern. Pure and vscode-free.
 */

// Matches "..." or '...' or `...` (no interpolation handling needed for
// static route configs; template literals with ${} are skipped below).
export const STRING_LITERAL_RE = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

export function looksLikeRoutePath(value: string, extensions: readonly string[]): boolean {
  if (!value) return false;
  if (value.includes("${")) return false; // dynamic template literal
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  return extensions.some((ext) => value.endsWith(ext));
}

export function looksLikeUrlPath(value: string): boolean {
  if (!value) return false;
  if (value.includes("${")) return false; // dynamic template literal
  if (/^https?:\/\//.test(value)) return false;
  if (!value.startsWith("/") || value.includes(" ")) return false;
  return true;
}

export function normalizeSegments(value: string): string[] {
  return value.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

export function segmentsMatch(patternSegments: readonly string[], literalSegments: readonly string[]): boolean {
  const lastIsSplat = patternSegments[patternSegments.length - 1] === "*";
  if (lastIsSplat) {
    if (literalSegments.length < patternSegments.length - 1) return false;
  } else if (patternSegments.length !== literalSegments.length) {
    return false;
  }
  for (let i = 0; i < patternSegments.length; i++) {
    const p = patternSegments[i];
    if (p === "*") return true;
    const l = literalSegments[i];
    if (l === undefined) return false;
    if (p.startsWith(":")) continue;
    if (p !== l) return false;
  }
  return true;
}
