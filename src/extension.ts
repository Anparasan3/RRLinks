import * as vscode from "vscode";
import { RoutesIndex } from "./routesIndex";
import { RoutePathLinkProvider } from "./routePathLinkProvider";
import { NextRoutesIndex } from "./nextRoutesIndex";

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: "typescript", scheme: "file" },
    { language: "javascript", scheme: "file" },
    { language: "typescriptreact", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
  ];

  const routesIndex = new RoutesIndex();
  const nextRoutesIndex = new NextRoutesIndex();
  const provider = new RoutePathLinkProvider(routesIndex, nextRoutesIndex);

  // Route files are found on disk and cached, so a file added, removed or
  // renamed inside VS Code (a new routes.ts, a new Next.js route) should
  // show up right away rather than after the cache expires.
  const invalidate = () => {
    routesIndex.invalidate();
    nextRoutesIndex.invalidate();
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(selector, provider),
    vscode.workspace.onDidCreateFiles(invalidate),
    vscode.workspace.onDidDeleteFiles(invalidate),
    vscode.workspace.onDidRenameFiles(invalidate),
    // Multi-root workspaces: drop cached data for removed folders and look
    // up added ones fresh.
    vscode.workspace.onDidChangeWorkspaceFolders(invalidate)
  );
}

export function deactivate(): void {}
