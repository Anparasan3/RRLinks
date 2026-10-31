# React Router Route Links

Makes route file paths **and** API route strings in React Router v7+ (and
Remix) projects clickable in VS Code — Ctrl+Click any of them to jump
straight to the file that handles it.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/anparasan.routelinks?label=marketplace&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=anparasan.routelinks)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/anparasan.routelinks)](https://marketplace.visualstudio.com/items?itemName=anparasan.routelinks)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/anparasan.routelinks)](https://marketplace.visualstudio.com/items?itemName=anparasan.routelinks)
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
- Also links matching route/API path strings (e.g. `/api/users/:id`) found in
  *any* `.ts`/`.js`/`.tsx`/`.jsx` file back to the route module that handles them
- Only links to files that actually exist — a typo'd path simply won't
  underline, doubling as a lightweight sanity check
- Zero runtime dependencies, lightweight

## Settings

Customize which files and extensions are treated as route links via
`Settings → Extensions → React Router Route Links`, or in `settings.json`:

| Setting | Default | Description |
|---|---|---|
| `reactRouterRouteLinks.fileNames` | `routes.ts`, `routes.js`, `routes.tsx`, `routes.jsx` | Which files get link treatment |
| `reactRouterRouteLinks.extensions` | `.tsx`, `.ts`, `.jsx`, `.js`, `.mdx`, `.md` | String suffixes treated as route paths |

## FAQ

**Does it work with Remix?**  
Yes. Remix uses the same `routes.ts` config format, so route and API path
strings are clickable there too.

**Does it work with React Router v6?**  
The clickable-`routes.ts` feature targets the React Router v7 / Remix config
format. Older file-based routing conventions are not resolved.

**Do I need a specific folder layout?**  
No. Paths resolve relative to the `routes.ts` file first, then the workspace
root, `app/`, `src/app/`, and `src/`. If the config lives somewhere unusual,
the extension searches the workspace for it.

**Does it slow down VS Code?**  
No. There are no file watchers or runtime dependencies. The routes config is
parsed once and cached until it changes on disk.

**Will it link dynamic template literals?**  
No. Values like `/users/${id}` aren't statically known, so they're skipped.
Static strings are linked normally.

## Found a bug or have a request?

Open an issue on [GitHub](https://github.com/Anparasan3/route-links/issues).

## License

MIT © Anparasan T