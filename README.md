# React Router Route Links

Makes route file paths in React Router v7+ config files clickable in VS Code.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC.svg)

![RouteLinks banner](assets/linkedin-banner.png)


## The problem

VS Code's TypeScript server only supports go-to-definition on real `import`
statements. But in a React Router v7+ `routes.ts` config, route modules are
referenced as plain strings:

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
```

Those strings are inert to VS Code — no Ctrl+Click, no quick navigation.
Every time you want to check what `"routes/home.tsx"` actually renders, you're
manually hunting through folders.

## What this extension does

It turns those route path strings into real, clickable links.

Hover over `"routes/home.tsx"` and it underlines like a link. Ctrl+Click
(Cmd+Click on macOS) opens the file directly — no manual searching, no
breaking your flow to go dig through the file tree.

It also works the other way: in *any* `.ts`/`.js`/`.tsx`/`.jsx` file, a
string like `"/api/someroute/:someId/some"` becomes clickable too, as long as
that path is actually defined in `routes.ts` (including nested `route()`,
`index()`, `layout()`, and `prefix()` calls) — Ctrl+Click jumps straight to
the module that handles it.

## Install

Search **"React Router Route Links"** in the VS Code Extensions panel, or:

```bash
code --install-extension anparasan.routelinks
```

## Features

- Works automatically in `routes.ts` / `routes.js` / `routes.tsx` / `routes.jsx`
- Resolves paths relative to the routes file's own directory (the `app/` dir),
  with fallbacks to the workspace root, `app/`, and `src/`
- Only links to files that actually exist — a typo'd path simply won't
  underline, doubling as a lightweight sanity check
- Zero dependencies, no build step, lightweight

## Settings

Customize which files and extensions are treated as route links via
`Settings → Extensions → React Router Route Links`, or in `settings.json`:

| Setting | Default | Description |
|---|---|---|
| `reactRouterRouteLinks.fileNames` | `routes.ts`, `routes.js`, `routes.tsx`, `routes.jsx` | Which files get link treatment |
| `reactRouterRouteLinks.extensions` | `.tsx`, `.ts`, `.jsx`, `.js`, `.mdx`, `.md` | String suffixes treated as route paths |

## Found a bug or have a request?

Open an issue on [GitHub](https://github.com/Anparasan3/route-links/issues).

## License

MIT © Anparasan T