import * as vscode from "vscode";

export interface RouteLinksConfig {
  fileNames: string[];
  extensions: string[];
}

const DEFAULT_FILE_NAMES = ["routes.ts", "routes.js", "routes.tsx", "routes.jsx"];
const DEFAULT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"];

export function getRouteLinksConfig(): RouteLinksConfig {
  const cfg = vscode.workspace.getConfiguration("reactRouterRouteLinks");
  return {
    fileNames: cfg.get("fileNames", DEFAULT_FILE_NAMES),
    extensions: cfg.get("extensions", DEFAULT_EXTENSIONS),
  };
}
