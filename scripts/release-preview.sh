#!/usr/bin/env bash
# Cuts a preview release.
#
# The VS Code Marketplace rejects a semver prerelease version string
# (e.g. "0.0.5-preview.0") outright, so package.json's "version" must always
# stay a plain X.Y.Z. The git tag carries the -preview.N suffix instead; the
# publish workflow strips it before comparing to package.json.
#
# Usage:
#   scripts/release-preview.sh patch|minor|major   # bump to a new target version, cut its first preview (.0)
#   scripts/release-preview.sh                      # no bump: cut the next preview (.1, .2, ...) of the current version
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" != "" ]; then
  bun pm version "$1" --no-git-tag-version
  git add package.json
  git commit -m "Bump version to $(bun -e "console.log(require('./package.json').version)")"
fi

VERSION=$(bun -e "console.log(require('./package.json').version)")
LAST=$(git tag -l "v${VERSION}-preview.*" | sed -E 's/.*-preview\.([0-9]+)$/\1/' | sort -n | tail -1)
NEXT=$(( ${LAST:--1} + 1 ))
TAG="v${VERSION}-preview.${NEXT}"

git tag -a "$TAG" -m "$TAG"
echo "Created $TAG"
echo "Push with: git push origin HEAD --follow-tags"
