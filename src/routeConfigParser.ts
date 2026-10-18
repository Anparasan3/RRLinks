import { findMatchingParen, splitTopLevelArgs, parseStringLiteral } from "./jsExpressionParsing";

/**
 * Parses a React Router v7 routes.ts config (route/index/layout/prefix
 * calls, including nesting) into a flat list of { pattern, file } pairs.
 * Pure and vscode-free — safe to unit test directly.
 */

export interface RouteEntry {
  pattern: string;
  file: string;
}

type RouteCallName = "route" | "index" | "layout" | "prefix";

const ROUTE_CALL_RE = /\b(route|index|layout|prefix)\s*\(/g;

export function joinRoutePath(parent: string, segment: string): string {
  const p = (parent || "").replace(/^\/+|\/+$/g, "");
  const s = (segment || "").replace(/^\/+|\/+$/g, "");
  return [p, s].filter(Boolean).join("/");
}

// Returns a flat list of { pattern, file } pairs (file is the raw string
// from the config, not yet resolved to an absolute path).
export function parseRoutesConfig(source: string): RouteEntry[] {
  const routes: RouteEntry[] = [];
  walk(source, "");
  return routes;

  function walk(region: string, parentPath: string): void {
    const callRe = new RegExp(ROUTE_CALL_RE);
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(region)) !== null) {
      const name = m[1] as RouteCallName;
      const openParen = m.index + m[0].length - 1;
      const closeParen = findMatchingParen(region, openParen);
      if (closeParen === -1) break;
      const args = splitTopLevelArgs(region.slice(openParen + 1, closeParen));
      handle(name, args, parentPath);
      callRe.lastIndex = closeParen + 1;
    }
  }

  function handle(name: RouteCallName, args: string[], parentPath: string): void {
    const childrenArg = args.find((a) => a.startsWith("["));

    if (name === "prefix") {
      const prefixPath = parseStringLiteral(args[0]) || "";
      if (childrenArg) walk(childrenArg, joinRoutePath(parentPath, prefixPath));
      return;
    }

    const stringArgs = args.map(parseStringLiteral).filter((v): v is string => v !== null);

    if (name === "index") {
      const file = stringArgs[0];
      if (file) routes.push({ pattern: parentPath, file });
      return;
    }

    // route(path, file, ...) or layout(file, ...) — layout has no path segment.
    const pathArg = name === "route" ? stringArgs[0] ?? null : null;
    const fileArg = name === "route" ? stringArgs[1] : stringArgs[0];
    const fullPath = pathArg !== null ? joinRoutePath(parentPath, pathArg) : parentPath;

    if (fileArg) routes.push({ pattern: fullPath, file: fileArg });
    if (childrenArg) walk(childrenArg, fullPath);
  }
}
