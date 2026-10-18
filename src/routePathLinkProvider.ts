import * as vscode from "vscode";
import * as path from "path";
import { RoutesIndex } from "./routesIndex";
import { getRouteLinksConfig } from "./config";
import { resolveExistingFile } from "./fileResolution";
import {
  STRING_LITERAL_RE,
  looksLikeRoutePath,
  looksLikeUrlPath,
  normalizeSegments,
  segmentsMatch,
} from "./routeMatching";

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
 *    (see ./routeConfigParser.ts, ./routeMatching.ts, and ./routesIndex.ts).
 *
 * Only emits links when the target file actually exists, so typos/no-match
 * simply don't underline.
 */
export class RoutePathLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private readonly routesIndex: RoutesIndex) {}

  async provideDocumentLinks(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
    const { fileNames, extensions } = getRouteLinksConfig();
    const links: vscode.DocumentLink[] = [];

    if (this.isRoutesFile(document, fileNames)) {
      links.push(...this.fileLinks(document, extensions));
    }
    links.push(...(await this.routePatternLinks(document, fileNames)));

    return links;
  }

  private isRoutesFile(document: vscode.TextDocument, fileNames: readonly string[]): boolean {
    const base = path.basename(document.uri.fsPath || document.fileName || "");
    return fileNames.includes(base);
  }

  private fileLinks(document: vscode.TextDocument, extensions: readonly string[]): vscode.DocumentLink[] {
    const text = document.getText();
    const links: vscode.DocumentLink[] = [];
    let match: RegExpExecArray | null;

    STRING_LITERAL_RE.lastIndex = 0;
    while ((match = STRING_LITERAL_RE.exec(text)) !== null) {
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
    fileNames: readonly string[]
  ): Promise<vscode.DocumentLink[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return [];

    const routeMap = await this.routesIndex.getRouteMap(workspaceFolder, fileNames);
    if (!routeMap.length) return [];

    const text = document.getText();
    const links: vscode.DocumentLink[] = [];
    let match: RegExpExecArray | null;

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
