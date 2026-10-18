const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

/**
 * Two link kinds, both Ctrl+Click:
 *
 * 1. File links inside the routes config itself (app/routes.ts): a string
 *    literal like "routes/home.tsx" becomes a link to that module.
 *
 * 2. Route-pattern links anywhere else (any ts/js/tsx/jsx file): a string
 *    literal that looks like a URL path, e.g. "/api/someroute/:someId/some",
 *    becomes a link to the module that actually handles that route, found by
 *    parsing the project's routes.ts config (route/index/layout/prefix
 *    calls, including nesting).
 *
 * Only emits links when the target file actually exists, so typos/no-match
 * simply don't underline.
 */

// Matches "..." or '...' or `...` (no interpolation handling needed for
// static route configs; template literals with ${} are skipped below).
const STRING_LITERAL_RE = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("reactRouterRouteLinks");
  return {
    fileNames: cfg.get("fileNames", ["routes.ts", "routes.js", "routes.tsx", "routes.jsx"]),
    extensions: cfg.get("extensions", [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"]),
  };
}

function isRoutesFile(document, fileNames) {
  const base = path.basename(document.uri.fsPath || document.fileName || "");
  return fileNames.includes(base);
}

function looksLikeRoutePath(value, extensions) {
  if (!value) return false;
  if (value.includes("${")) return false; // dynamic template literal
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  return extensions.some((ext) => value.endsWith(ext));
}

function resolveTarget(document, value) {
  const candidates = [];

  // 1. Relative to the routes file's own directory (the app/ dir in RR v7).
  const baseDir = path.dirname(document.uri.fsPath);
  candidates.push(path.resolve(baseDir, value));

  // 2. Relative to the workspace root (covers unusual setups).
  const ws = vscode.workspace.getWorkspaceFolder(document.uri);
  if (ws) {
    candidates.push(path.resolve(ws.uri.fsPath, value));
    candidates.push(path.resolve(ws.uri.fsPath, "app", value));
    candidates.push(path.resolve(ws.uri.fsPath, "src", value));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return vscode.Uri.file(candidate);
      }
    } catch {
      /* ignore fs errors, try next candidate */
    }
  }
  return null;
}

// ---- Route config parsing (route/index/layout/prefix, with nesting) ----

function findMatchingParen(str, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelArgs(str) {
  const args = [];
  let depth = 0;
  let current = "";
  let inString = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      current += ch;
      if (ch === "\\") {
        current += str[++i] ?? "";
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      current += ch;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseStringLiteral(arg) {
  if (!arg) return null;
  const m = /^(["'`])([\s\S]*)\1$/.exec(arg.trim());
  return m ? m[2] : null;
}

function joinRoutePath(parent, segment) {
  const p = (parent || "").replace(/^\/+|\/+$/g, "");
  const s = (segment || "").replace(/^\/+|\/+$/g, "");
  return [p, s].filter(Boolean).join("/");
}

// Returns a flat list of { pattern, file } pairs (file is the raw string
// from the config, not yet resolved to an absolute path).
function parseRoutesConfig(source) {
  const routes = [];
  walk(source, "");
  return routes;

  function walk(region, parentPath) {
    const callRe = /\b(route|index|layout|prefix)\s*\(/g;
    let m;
    while ((m = callRe.exec(region)) !== null) {
      const name = m[1];
      const openParen = m.index + m[0].length - 1;
      const closeParen = findMatchingParen(region, openParen);
      if (closeParen === -1) break;
      const args = splitTopLevelArgs(region.slice(openParen + 1, closeParen));
      handle(name, args, parentPath);
      callRe.lastIndex = closeParen + 1;
    }
  }

  function handle(name, args, parentPath) {
    const childrenArg = args.find((a) => a.startsWith("["));

    if (name === "prefix") {
      const prefixPath = parseStringLiteral(args[0]) || "";
      if (childrenArg) walk(childrenArg, joinRoutePath(parentPath, prefixPath));
      return;
    }

    const stringArgs = args.map(parseStringLiteral).filter((v) => v !== null);

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

function normalizeSegments(value) {
  return value.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

function segmentsMatch(patternSegments, literalSegments) {
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

function looksLikeUrlPath(value) {
  if (!value) return false;
  if (value.includes("${")) return false; // dynamic template literal
  if (/^https?:\/\//.test(value)) return false;
  if (!value.startsWith("/") || value.includes(" ")) return false;
  return true;
}

// ponytail: cache the located path per workspace so repeat lookups are free;
// re-search only if the cached path stops existing (renamed/deleted).
const routesFileLocationCache = new Map();

async function locateRoutesFile(workspaceFolder, fileNames) {
  const key = workspaceFolder.uri.toString();
  const cached = routesFileLocationCache.get(key);
  if (cached && fs.existsSync(cached)) return cached;

  for (const dir of ["app", "src/app", "src", "."]) {
    for (const name of fileNames) {
      const candidate = path.join(workspaceFolder.uri.fsPath, dir, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        routesFileLocationCache.set(key, candidate);
        return candidate;
      }
    }
  }

  // Fallback for unconventional layouts: search the whole workspace folder.
  const pattern = new vscode.RelativePattern(workspaceFolder, `**/{${fileNames.join(",")}}`);
  const found = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 1);
  const result = found[0] ? found[0].fsPath : null;
  routesFileLocationCache.set(key, result);
  return result;
}

function resolveRouteFileTarget(routesFsPath, workspaceFolder, fileValue) {
  const candidates = [
    path.resolve(path.dirname(routesFsPath), fileValue),
    path.resolve(workspaceFolder.uri.fsPath, fileValue),
    path.resolve(workspaceFolder.uri.fsPath, "app", fileValue),
    path.resolve(workspaceFolder.uri.fsPath, "src/app", fileValue),
    path.resolve(workspaceFolder.uri.fsPath, "src", fileValue),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* ignore fs errors, try next candidate */
    }
  }
  return null;
}

// ponytail: cache keyed by workspace + routes file mtime, no file watcher —
// re-parsing on a changed-mtime read is cheap and this file is small.
const routeMapCache = new Map();

async function getRouteMap(workspaceFolder, fileNames) {
  const routesFsPath = await locateRoutesFile(workspaceFolder, fileNames);
  if (!routesFsPath) return [];

  let mtimeMs;
  try {
    mtimeMs = fs.statSync(routesFsPath).mtimeMs;
  } catch {
    return [];
  }

  const key = workspaceFolder.uri.toString();
  const cached = routeMapCache.get(key);
  if (cached && cached.routesFsPath === routesFsPath && cached.mtimeMs === mtimeMs) {
    return cached.entries;
  }

  let source;
  try {
    source = fs.readFileSync(routesFsPath, "utf8");
  } catch {
    return [];
  }

  const entries = [];
  for (const { pattern, file } of parseRoutesConfig(source)) {
    const target = resolveRouteFileTarget(routesFsPath, workspaceFolder, file);
    if (!target) continue;
    entries.push({ segments: normalizeSegments(pattern), file: target });
  }

  routeMapCache.set(key, { routesFsPath, mtimeMs, entries });
  return entries;
}

class RoutePathLinkProvider {
  async provideDocumentLinks(document) {
    const { fileNames, extensions } = getConfig();
    const links = [];

    if (isRoutesFile(document, fileNames)) {
      links.push(...this.fileLinks(document, extensions));
    }
    links.push(...(await this.routePatternLinks(document, fileNames)));

    return links;
  }

  fileLinks(document, extensions) {
    const text = document.getText();
    const links = [];
    let match;

    STRING_LITERAL_RE.lastIndex = 0;
    while ((match = STRING_LITERAL_RE.exec(text)) !== null) {
      const value = match[2];
      if (!looksLikeRoutePath(value, extensions)) continue;

      const target = resolveTarget(document, value);
      if (!target) continue;

      // Range covers just the string contents, not the quotes.
      const start = document.positionAt(match.index + 1);
      const end = document.positionAt(match.index + 1 + value.length);
      const link = new vscode.DocumentLink(new vscode.Range(start, end), target);
      link.tooltip = "Open route module";
      links.push(link);
    }
    return links;
  }

  async routePatternLinks(document, fileNames) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return [];

    const routeMap = await getRouteMap(workspaceFolder, fileNames);
    if (!routeMap.length) return [];

    const text = document.getText();
    const links = [];
    let match;

    STRING_LITERAL_RE.lastIndex = 0;
    while ((match = STRING_LITERAL_RE.exec(text)) !== null) {
      const value = match[2];
      if (!looksLikeUrlPath(value)) continue;

      const literalSegments = normalizeSegments(value);
      const entry = routeMap.find((e) => segmentsMatch(e.segments, literalSegments));
      if (!entry) continue;

      const start = document.positionAt(match.index + 1);
      const end = document.positionAt(match.index + 1 + value.length);
      const link = new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.file(entry.file));
      link.tooltip = "Open matching route module";
      links.push(link);
    }
    return links;
  }
}

function activate(context) {
  const selector = [
    { language: "typescript", scheme: "file" },
    { language: "javascript", scheme: "file" },
    { language: "typescriptreact", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
  ];
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(selector, new RoutePathLinkProvider())
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
