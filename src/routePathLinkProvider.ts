import * as vscode from "vscode";
import * as path from "path";
import { RoutesIndex, type ResolvedRoute } from "./routesIndex";
import { getRouteLinksConfig } from "./config";
import { resolveExistingFile, isInside } from "./fileResolution";
import {
  STRING_LITERAL_RE,
  looksLikeRoutePath,
  looksLikeUrlPath,
  normalizeSegments,
  stripQueryAndHash,
  RouteLookup,
} from "./routeMatching";
import { NextRoutesIndex } from "./nextRoutesIndex";
import { isInExcludedFolder } from "./excludedFolders";

// ~1 MB. Hand-written source files are far smaller; anything bigger is
// almost always a bundle, minified or generated file.
const MAX_DOCUMENT_CHARS = 1_000_000;

/** The match whose project folder contains `docPath` most specifically
 * (deepest folder); keeps the first such match on a tie. */
function closestApp(matches: readonly ResolvedRoute[], docPath: string): ResolvedRoute | undefined {
  let best: ResolvedRoute | undefined;
  for (const m of matches) {
    if (!m.root || !isInside(docPath, m.root)) continue;
    if (!best || m.root.length > best.root!.length) best = m;
  }
  return best;
}

/**
 * Two link kinds, both Ctrl+Click:
 *
 * 1. File links inside the routes config itself (app/routes.ts): a string
 *    literal like "routes/home.tsx" becomes a link to that module.
 *
 * 2. Route-pattern links anywhere else (any ts/js/tsx/jsx file): a string
 *    literal that looks like a URL path, e.g. "/api/someroute/:someId/some",
 *    becomes a link to the module that actually handles that route, found by
 *    parsing the project's routes.ts config via the injected RoutesIndex
 *    (see ./routeConfigParser.ts, ./routeMatching.ts, and ./routesIndex.ts),
 *    or, in a Next.js project, from its app/ and pages/ files via
 *    NextRoutesIndex (see ./nextjsRoutes.ts and ./nextRoutesIndex.ts).
 *
 * Only emits links when the target file actually exists, so typos/no-match
 * simply don't underline.
 */
export class RoutePathLinkProvider implements vscode.DocumentLinkProvider {
  constructor(
    private readonly routesIndex: RoutesIndex,
    private readonly nextRoutesIndex: NextRoutesIndex
  ) {}

  async provideDocumentLinks(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return [];
    const { fileNames, extensions, excludeFolders } = getRouteLinksConfig();

    // Never scan dependencies, build output, generated code or huge files
    // (bundles, minified code): they hold no hand-written route links.
    if (isInExcludedFolder(document.uri.fsPath, workspaceFolder.uri.fsPath, excludeFolders)) return [];
    const text = document.getText();
    if (text.length > MAX_DOCUMENT_CHARS) return [];

    const links: vscode.DocumentLink[] = [];

    if (this.isRoutesFile(document, fileNames)) {
      links.push(...this.fileLinks(document, text, extensions, token));
    }
    links.push(...(await this.routePatternLinks(document, workspaceFolder, text, fileNames, excludeFolders, token)));

    return links;
  }

  private isRoutesFile(document: vscode.TextDocument, fileNames: readonly string[]): boolean {
    const base = path.basename(document.uri.fsPath || document.fileName || "");
    return fileNames.includes(base);
  }

  private fileLinks(
    document: vscode.TextDocument,
    text: string,
    extensions: readonly string[],
    token?: vscode.CancellationToken
  ): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    let match: RegExpExecArray | null;

    STRING_LITERAL_RE.lastIndex = 0;
    while ((match = STRING_LITERAL_RE.exec(text)) !== null) {
      if (token?.isCancellationRequested) return [];
      const value = match[2];
      if (!looksLikeRoutePath(value, extensions)) continue;

      const target = this.resolveFileLinkTarget(document, value);
      if (!target) continue;

      // Range covers just the string contents, not the quotes.
      const start = document.positionAt(match.index + 1);
      const end = document.positionAt(match.index + 1 + value.length);
      const link = new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.file(target));
      link.tooltip = "Open route module";
      links.push(link);
    }
    return links;
  }

  private resolveFileLinkTarget(document: vscode.TextDocument, value: string): string | null {
    const candidates = [path.resolve(path.dirname(document.uri.fsPath), value)];

    // Relative to the workspace root (covers unusual setups).
    const ws = vscode.workspace.getWorkspaceFolder(document.uri);
    if (ws) {
      candidates.push(
        path.resolve(ws.uri.fsPath, value),
        path.resolve(ws.uri.fsPath, "app", value),
        path.resolve(ws.uri.fsPath, "src", value)
      );
    }

    return resolveExistingFile(candidates);
  }

  private async routePatternLinks(
    document: vscode.TextDocument,
    workspaceFolder: vscode.WorkspaceFolder,
    text: string,
    fileNames: readonly string[],
    excludeFolders: readonly string[],
    token?: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const [reactRouterRoutes, nextRoutes] = await Promise.all([
      this.routesIndex.getRouteMap(workspaceFolder, fileNames, excludeFolders),
      this.nextRoutesIndex.getRouteMap(workspaceFolder, document.uri.fsPath, excludeFolders),
    ]);
    if (token?.isCancellationRequested) return [];
    const lookup = new RouteLookup([...reactRouterRoutes, ...nextRoutes]);
    if (!lookup.size) return [];

    const links: vscode.DocumentLink[] = [];
    let match: RegExpExecArray | null;
    let scanned = 0;

    STRING_LITERAL_RE.lastIndex = 0;
    while ((match = STRING_LITERAL_RE.exec(text)) !== null) {
      // A newer request (the user kept typing) supersedes this one.
      if (++scanned % 500 === 0 && token?.isCancellationRequested) return [];
      const value = match[2];
      if (!looksLikeUrlPath(value)) continue;

      const literalSegments = normalizeSegments(stripQueryAndHash(value));
      // Several apps in one workspace can define the same path; the app
      // closest to this document wins, otherwise the first match.
      const matches = lookup.matches(literalSegments);
      const entry = closestApp(matches, document.uri.fsPath) ?? matches[0];
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
