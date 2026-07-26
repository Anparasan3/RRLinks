# React Router Route Links

Makes route file paths in React Router v7 config files clickable.

In `app/routes.ts`:

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),          // ← Ctrl+Click now opens routes/home.tsx
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```

VS Code's TypeScript server only supports go-to-definition on real `import`
paths, so these plain string arguments are normally inert. This extension
registers a `DocumentLinkProvider` that turns any string literal ending in a
known file extension into a real link — hover shows the underline, and
Ctrl+Click (Cmd+Click on macOS) opens the file.

## Features

- Works in `routes.ts` / `routes.js` / `routes.tsx` / `routes.jsx` (configurable)
- Resolves paths relative to the routes file's directory (the `app/` dir),
  with fallbacks to the workspace root, `app/`, and `src/`
- Only links to files that actually exist — a typo'd path simply won't
  underline, which doubles as a lightweight sanity check
- Zero dependencies, no build step, plain JavaScript

## Install from the .vsix

```bash
code --install-extension routelinks-0.0.1.vsix
```

Or in VS Code: Extensions panel → `…` menu → **Install from VSIX…**

## Develop / modify

1. Open this folder in VS Code
2. Press `F5` (Run Extension) — a new Extension Development Host window opens
3. Open a React Router project there and try Ctrl+Click in `app/routes.ts`

To rebuild the package after changes:

```bash
npm install -g @vscode/vsce
vsce package
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `reactRouterRouteLinks.fileNames` | `routes.ts`, `routes.js`, `routes.tsx`, `routes.jsx` | Which files get link treatment |
| `reactRouterRouteLinks.extensions` | `.tsx`, `.ts`, `.jsx`, `.js`, `.mdx`, `.md` | String suffixes treated as route paths |

## License

MIT © Anparasan T
