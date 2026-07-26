# Contributing / Development

This file is for anyone building, modifying, or releasing this extension.
It is **not** shown on the VS Code Marketplace listing — that only renders
`README.md`.

## Project structure

```
route-links/
├── package.json               # extension manifest
├── src/
│   └── extension.js           # activation + DocumentLinkProvider logic
├── icon.png                   # marketplace icon (128×128)
├── README.md                  # user-facing, shown on Marketplace
├── CONTRIBUTING.md            # this file
├── LICENSE
├── .vscodeignore               # files excluded from the packaged .vsix
└── .github/workflows/publish.yml
```

## Tooling

This project uses [Bun](https://bun.sh) instead of npm. No runtime
dependencies, no build step — it's plain JavaScript.

## Run locally

1. Clone the repo and open the folder in VS Code
2. Press `F5` (Run Extension) — opens a new Extension Development Host window
3. Open a React Router v7+ project there and try Ctrl+Click inside `app/routes.ts`

## Package and test the .vsix locally

```bash
bun install -g @vscode/vsce
vsce package
code --install-extension routelinks-<version>.vsix
```

## Publish a new version

Releases are automated via GitHub Actions
([`.github/workflows/publish.yml`](.github/workflows/publish.yml)), triggered
by pushing a version tag:

```bash
# bump "version" in package.json first, then:
git add . && git commit -m "v0.0.2: description of changes"
git tag v0.0.2
git push origin main --tags
```

The workflow verifies the tag matches `package.json`'s version, packages the
extension, and publishes it automatically using the `VSCE_PAT` repository
secret.

### Manual publish (fallback)

```bash
vsce login {username}
vsce publish
```

### Rotating the Marketplace PAT

Azure DevOps PATs expire (max 1 year). When it expires:

1. Generate a new one at dev.azure.com → User Settings → Personal Access
   Tokens → New Token (Organization: "All accessible organizations", Scope:
   Marketplace → Manage)
2. Update the `VSCE_PAT` secret at
   `github.com/Anparasan3/route-links/settings/secrets/actions`
3. Optionally re-run `vsce login {username}` locally with the new token

## Contributing

PRs welcome. Keep changes dependency-free and consistent with the existing
plain-JS style — this extension intentionally has no build step or bundler.