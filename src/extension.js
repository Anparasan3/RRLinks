const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

/**
 * Makes string literals that look like route module paths (e.g. "routes/home.tsx")
 * inside React Router v7 config files (app/routes.ts) clickable with Ctrl+Click.
 *
 * How it works:
 * - Registers a DocumentLinkProvider for TS/JS files.
 * - Only activates for files whose basename matches the configured list
 *   (default: routes.ts / routes.js / routes.tsx / routes.jsx).
 * - Scans for string literals ending in a known file extension.
 * - Resolves each path relative to the directory containing the routes file
 *   (React Router v7 resolves route modules relative to the app directory,
 *   which is where routes.ts lives). Falls back to the workspace root.
 * - Only emits a link if the target file actually exists, so typos don't
 *   produce dead links.
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

class RoutePathLinkProvider {
  provideDocumentLinks(document) {
    const { fileNames, extensions } = getConfig();
    if (!isRoutesFile(document, fileNames)) return [];

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
