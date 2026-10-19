#!/usr/bin/env bash
# Cuts a preview release.
#
# The VS Code Marketplace rejects a semver prerelease version string
# (e.g. "0.0.5-preview") outright, so package.json's "version" must always
# stay a plain X.Y.Z. The git tag carries a "-preview" suffix instead; the
# publish workflow strips it before comparing to package.json.
#
# The Marketplace also refuses to publish the same version number twice,
# even across the release/pre-release tracks — so every preview release
# bumps the version forward, exactly like a stable release does. There's no
# way to cut a second preview "of the same version"; bump again instead.
#
# Usage: scripts/release-preview.sh patch|minor|major
set -euo pipefail
cd "$(dirname "$0")/.."

INCREMENT="${1:?Usage: scripts/release-preview.sh patch|minor|major}"
bun pm version "$INCREMENT" --no-git-tag-version
VERSION=$(bun -e "console.log(require('./package.json').version)")

git add package.json
git commit -m "v${VERSION}-preview"
git tag -a "v${VERSION}-preview" -m "v${VERSION}-preview"

echo "Created v${VERSION}-preview"
echo "Push with: git push origin HEAD --follow-tags"
