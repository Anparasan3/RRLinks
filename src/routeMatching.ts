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

/** "/api/x?range=7d#top" -> "/api/x". Only for string literals, not route
 * patterns, where "?" marks an optional segment (":id?"). */
export function stripQueryAndHash(value: string): string {
  return value.replace(/[?#].*$/, "");
}

export function normalizeSegments(value: string): string[] {
  return value.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/**
 * Fast route lookup: static routes (no ":param" / "*") are found with one
 * map lookup; only dynamic routes are checked one by one. Results list
 * static matches first, then dynamic ones in their original order.
 */
export class RouteLookup<T extends { segments: readonly string[] }> {
  private readonly exact = new Map<string, T[]>();
  private readonly dynamic: T[] = [];

  constructor(routes: readonly T[]) {
    for (const route of routes) {
      if (route.segments.some((s) => s === "*" || s.startsWith(":"))) {
        this.dynamic.push(route);
      } else {
        const key = route.segments.join("/");
        const bucket = this.exact.get(key);
        if (bucket) bucket.push(route);
        else this.exact.set(key, [route]);
      }
    }
  }

  get size(): number {
    return this.exact.size + this.dynamic.length;
  }

  matches(literalSegments: readonly string[]): T[] {
    const found = [...(this.exact.get(literalSegments.join("/")) ?? [])];
    for (const route of this.dynamic) {
      if (segmentsMatch(route.segments, literalSegments)) found.push(route);
    }
    return found;
  }
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
