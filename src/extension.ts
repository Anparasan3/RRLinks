import * as vscode from "vscode";
import { RoutesIndex } from "./routesIndex";
import { RoutePathLinkProvider } from "./routePathLinkProvider";

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: "typescript", scheme: "file" },
    { language: "javascript", scheme: "file" },
    { language: "typescriptreact", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
  ];

  const routesIndex = new RoutesIndex();
  const provider = new RoutePathLinkProvider(routesIndex);

  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, provider));
}

export function deactivate(): void {}
