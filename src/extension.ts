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

  // Next.js routes come from the file system, so a route file added,
  // removed or renamed inside VS Code should show up right away.
  const invalidateNext = () => nextRoutesIndex.invalidate();

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(selector, provider),
    vscode.workspace.onDidCreateFiles(invalidateNext),
    vscode.workspace.onDidDeleteFiles(invalidateNext),
    vscode.workspace.onDidRenameFiles(invalidateNext)
  );
}

export function deactivate(): void {}
