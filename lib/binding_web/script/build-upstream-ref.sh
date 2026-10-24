#!/usr/bin/env bash
#
# Rebuilds the vendored upstream web-tree-sitter reference used by
# test/differential.test.ts.
#
# The differential test compares this fork's WASI build against an independent,
# *version-matched* upstream build. The reference is the Emscripten build of
# tree-sitter/tree-sitter at the exact commit this fork is synced to, so the
# comparison isolates WASI-vs-Emscripten build differences instead of
# release-vs-master runtime drift.
#
# Run this after each upstream sync and update UPSTREAM_REF to the new commit.
# Requires either `emcc` on PATH or a working Docker/Podman (the upstream xtask
# pulls docker.io/emscripten/emsdk:<version> automatically).
#
# Usage:
#   lib/binding_web/script/build-upstream-ref.sh [<commit-ish>]
set -euo pipefail

UPSTREAM_REF="${1:-64aaee668e32b184c73ce79f93376f4f7fc62e89}"
UPSTREAM_URL="https://github.com/tree-sitter/tree-sitter.git"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # lib/binding_web
dest="$here/test/vendor/upstream-ref"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo ">> cloning $UPSTREAM_URL @ $UPSTREAM_REF"
git clone --quiet "$UPSTREAM_URL" "$work/ts"
git -C "$work/ts" checkout --quiet "$UPSTREAM_REF"

echo ">> building web-tree-sitter.wasm (Emscripten)"
( cd "$work/ts" && cargo xtask build-wasm )

echo ">> building the TS wrapper and declarations"
( cd "$work/ts/lib/binding_web" && npm install && npm run build:ts && npm run build:dts )

echo ">> vendoring artifacts into $dest"
src="$work/ts/lib/binding_web"
cp "$src/web-tree-sitter.js" "$src/web-tree-sitter.wasm" "$src/web-tree-sitter.d.ts" "$dest/"

echo ">> done. Vendored upstream reference is at version $(node -p "require('$src/package.json').version"), commit $UPSTREAM_REF"
echo ">> remember to bump the commit note in $dest/package.json"
