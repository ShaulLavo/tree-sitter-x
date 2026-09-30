#!/bin/sh
# Builds the npm package and commits it to the web-tree-sitter branch, so projects can install
# it from git ("web-tree-sitter": "github:ShaulLavo/tree-sitter-x#<commit>"): git installs
# take the repository root and cannot build, so the branch holds the built package at its root.
# Pass --push to push the branch.
set -eu
cd "$(dirname "$0")/.."
branch=web-tree-sitter
source_commit=$(git rev-parse --short HEAD)
work=$(mktemp -d)
trap 'git worktree remove --force "$work/branch" 2>/dev/null || true; rm -rf "$work"' EXIT

# Debug first: both builds write lib/web-tree-sitter.wasm, and the release one must win.
npm run build:debug
CJS=1 node script/build.js --debug
npm run build
CJS=1 node script/build.js
npm run build:dts
npm pack --pack-destination "$work"
tar xzf "$work"/*.tgz -C "$work"
node script/git-package-manifest.ts "$work/package/package.json"

git fetch -q origin "$branch"
git worktree add -q --detach "$work/branch" FETCH_HEAD
find "$work/branch" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$work/package/." "$work/branch/"
git -C "$work/branch" add -A
if git -C "$work/branch" diff --cached --quiet; then
  echo "$branch already matches $source_commit"
  exit 0
fi
git -C "$work/branch" commit -q -m "web-tree-sitter built from $source_commit"
echo "$branch: $(git -C "$work/branch" rev-parse --short HEAD), built from $source_commit"
if [ "${1:-}" = --push ]; then
  git -C "$work/branch" push -q origin "HEAD:refs/heads/$branch"
fi
