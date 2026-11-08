/**
 * Next.js file-system routing -> route pattern segments. Pure and vscode-free.
 *
 * Produces the same segment shape the routes.ts parser does (":param" for a
 * dynamic segment, "*" for a catch-all), so both feed ./routeMatching.ts.
 */

const CODE_FILE_RE = /^(.+)\.(tsx|ts|jsx|js)$/;

function toSegment(name: string): string {
  if (/^\[\[\.\.\..+\]\]$/.test(name) || /^\[\.\.\..+\]$/.test(name)) return "*";
  const dynamic = /^\[(.+)\]$/.exec(name);
  return dynamic ? `:${dynamic[1]}` : name;
}

/**
 * App Router: `relPath` is relative to the `app/` dir, e.g.
 * "api/analytics/summary/route.ts" -> ["api", "analytics", "summary"].
 * Only `route.*` and `page.*` files are routable.
 */
export function appRouterSegments(relPath: string): string[] | null {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  const file = parts.pop();
  if (!file || !/^(route|page)\.(tsx|ts|jsx|js)$/.test(file)) return null;

  const segments: string[] = [];
  for (const dir of parts) {
    if (dir.startsWith("_")) return null; // private folder: not routable
    if (dir.startsWith("(.")) return null; // intercepting route: shadows the real one
    if (dir.startsWith("(") && dir.endsWith(")")) continue; // route group
    if (dir.startsWith("@")) continue; // parallel route slot
    segments.push(toSegment(dir));
  }
  return segments;
}

/**
 * Pages Router: `relPath` is relative to the `pages/` dir, e.g.
 * "api/analytics/summary.ts" -> ["api", "analytics", "summary"],
 * "api/users/index.ts" -> ["api", "users"].
 */
export function pagesRouterSegments(relPath: string): string[] | null {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  const file = parts.pop();
  const match = file ? CODE_FILE_RE.exec(file) : null;
  if (!match) return null;

  const name = match[1];
  if (name.startsWith("_")) return null; // _app, _document, _error, _middleware
  if (name.endsWith(".d") || /\.(test|spec)$/.test(name)) return null;

  const names = name === "index" ? parts : [...parts, name];
  return names.map(toSegment);
}

// static < :param < * ; a missing segment ranks before any of them, so an
// exact "/files" beats "/files/*" when both match.
function segmentWeight(segment: string | undefined): number {
  if (segment === undefined) return -1;
  if (segment === "*") return 2;
  return segment.startsWith(":") ? 1 : 0;
}

/**
 * Orders routes most-specific first, mirroring Next.js's own resolution, so
 * "/api/users/me" picks `users/me/route.ts` over `users/[id]/route.ts`.
 */
export function compareSpecificity(a: readonly string[], b: readonly string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = segmentWeight(a[i]) - segmentWeight(b[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}
