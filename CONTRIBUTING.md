# Contributing / Development

This file is for anyone building, modifying, or releasing this extension.
It is **not** shown on the VS Code Marketplace listing — that only renders
`README.md`.

## Project structure

```
route-links/
├── package.json                    # extension manifest
├── tsconfig.json                   # compiles src/*.ts -> out/*.js
├── src/
│   ├── extension.ts                # composition root: activate/deactivate
│   ├── routePathLinkProvider.ts    # DocumentLinkProvider (SRP: produce links)
│   ├── routesIndex.ts              # locates/parses/caches a workspace's routes.ts
│   ├── routeConfigParser.ts        # pure: route/index/layout/prefix -> {pattern, file}[]
│   ├── routeConfigParser.test.ts   # unit tests (colocated)
│   ├── routeMatching.ts            # pure: detect + match route-path string literals
│   ├── routeMatching.test.ts       # unit tests (colocated)
│   ├── jsExpressionParsing.ts      # pure: generic balanced-paren/arg/string-literal helpers
│   ├── jsExpressionParsing.test.ts # unit tests (colocated)
│   ├── fileResolution.ts           # shared "does this candidate path exist" helper
│   └── config.ts                   # reads the extension's vscode settings
├── out/                            # compiled JS (gitignored, built by tsc)
├── scripts/
│   ├── release-preview.sh          # cuts a vX.Y.Z-preview.N tag without touching package.json's version
│   └── verify-install.ts           # installs a .vsix into a throwaway VS Code and checks it worked
├── icon.png                        # marketplace icon (128×128)
├── README.md                       # user-facing, shown on Marketplace
├── CONTRIBUTING.md                 # this file
├── LICENSE
├── .vscodeignore                   # files excluded from the packaged .vsix
└── .github/workflows/publish.yml
```

Each `src/` module has one job (SOLID's single-responsibility principle):
`jsExpressionParsing.ts` knows only generic JS call syntax (no route
knowledge at all); `routeConfigParser.ts` uses it to turn routes.ts into
`{pattern, file}` pairs; `routeMatching.ts` detects and matches route-path
string literals against those pairs — all three are pure data
transformation (no fs/vscode access, fully unit-testable). `fileResolution.ts`
and `routesIndex.ts` handle fs/vscode I/O, `routePathLinkProvider.ts`
implements the vscode API's `DocumentLinkProvider` by composing the above,
and `extension.ts` just wires concrete instances together (dependency
inversion: the provider depends on the `RoutesIndex` abstraction it's
handed, not on module-level globals).

## Tooling

This project uses [Bun](https://bun.sh) instead of npm. Source is
TypeScript, compiled with `tsc` to plain JS in `out/` — no bundler, no
runtime dependencies.

## Run locally

1. Clone the repo and run `bun install`
2. Run `bun run watch` to keep `out/` compiled as you edit (or `bun run compile` once)
3. Open the folder in VS Code and press `F5` (Run Extension) — opens a new
   Extension Development Host window
4. Open a React Router v7+ project there and try Ctrl+Click inside `app/routes.ts`

## Run tests

`src/routeConfig.ts` holds all the vscode-free logic (routes.ts parsing,
path/pattern matching) and is unit tested with Bun's built-in test runner,
run directly against the TypeScript source (no compile needed for tests):

```bash
bun test
```

The rest of `src/` is thin vscode/fs wiring and isn't unit tested; it's
covered by the manual `F5` check above.

## Package and test the .vsix locally

```bash
bun install -g @vscode/vsce
vsce package
code --install-extension routelinks-<version>.vsix
```

`vsce package` runs the `vscode:prepublish` script automatically, which
compiles TypeScript first — you don't need to run `bun run compile` yourself
before packaging.

## Publish a new version

Releases are automated via GitHub Actions
([`.github/workflows/publish.yml`](.github/workflows/publish.yml)), triggered
by pushing a version tag. Cutting that tag is a single command — nothing
else needs to be done by hand.

### Stable release

```bash
bun run release patch   # or: minor / major
git push --follow-tags
```

`bun run release` is `bun pm version` under the hood — it bumps `version` in
`package.json`, commits it, and creates a matching `vX.Y.Z` git tag, all
locally. Nothing is pushed until `git push --follow-tags`, which is what
actually triggers the workflow below.

### Preview release

The VS Code Marketplace rejects a semver prerelease version string outright
(`vsce publish` errors on `0.0.5-preview`), so `package.json`'s `version`
must always stay a plain `X.Y.Z` — only the **git tag** carries a
`-preview` suffix. The Marketplace also refuses to publish the same version
number twice, even across the release/pre-release tracks, so — just like a
stable release — every preview release bumps the version forward; there's
no way to cut a second preview build "of the same version". `bun run
release:preview` (see
[`scripts/release-preview.sh`](scripts/release-preview.sh)) handles the
plain-version/tagged-suffix split for you:

```bash
bun run release:preview patch   # or: minor / major -> v1.2.4-preview
git push origin HEAD --follow-tags

# ...fix something, cut another preview (bumps again, there's no re-using 1.2.4):
bun run release:preview patch   # -> v1.2.5-preview
git push origin HEAD --follow-tags
```

The workflow strips the `-preview` suffix before comparing the tag to
`package.json`, publishes to the VS Code Marketplace's separate
**Pre-Release** track (`vsce publish --pre-release`) instead of the normal
release track, and marks the GitHub Release as a **Pre-release** rather than
"Latest". Users only get preview builds if they explicitly opt in via
"Switch to Pre-Release Version" in VS Code.

Once a previewed version is good enough to ship as stable, it ships under
the **next** version number, not the previewed one (which is already
consumed on the Marketplace) — just a normal stable release:

```bash
bun run release patch   # or minor / major, whatever's appropriate
git push --follow-tags
```

### Triggering a release without a terminal

Both commands above work from the Actions tab too: open **Publish
Extension** → **Run workflow**, pick a branch, a channel (`stable` /
`preview`), and a version bump (`patch` / `minor` / `major`). A separate
`cut-tag` job does exactly what `bun run release`/`release:preview` do
locally — bump, commit, tag, push — and that push then triggers the same
`publish` job described below, so a manual run behaves identically to a
local one.

### What the workflow does

It installs dependencies, verifies the tag matches `package.json`'s version,
runs the tests, packages the extension (compiling TypeScript via
`vscode:prepublish`), **installs the freshly built `.vsix` into a real,
throwaway VS Code** ([`scripts/verify-install.ts`](scripts/verify-install.ts),
via `@vscode/test-electron`) and confirms it shows up in
`--list-extensions` — failing the whole run before anything is published if
it doesn't install cleanly — then publishes to the Marketplace using the
`VSCE_PAT` repository secret, and creates a GitHub Release for the tag with
auto-generated notes (from merged commits) and the `.vsix` attached.

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

PRs welcome. Keep runtime dependencies at zero — devDependencies for
TypeScript/testing are fine, but the extension itself should never need a
package installed at runtime. Keep new logic that doesn't touch fs/vscode in
`routeConfig.ts` (or a similar pure module) so it stays unit-testable.
