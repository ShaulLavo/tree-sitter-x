#!/bin/sh
# Builds lib/web-tree-sitter.wasm with the WASI SDK: the runtime, the binding glue and
# the libc subset grammars may import, with no Emscripten runtime. src/wasi-module.ts
# instantiates it and links grammar modules into its memory and function table.
set -eu
cd "$(dirname "$0")/.."
: "${WASI_SDK:=$HOME/.cache/tree-sitter/wasi-sdk}"
: "${OPT:=-O3}"

# lib/extra-exports.txt: libc functions published grammars import beyond
# wasm-stdlib/imports.txt, which Emscripten's runtime provided implicitly.
exports=$(cat ../src/wasm-stdlib/imports.txt lib/extra-exports.txt lib/exports.txt | tr -d '", ' | grep -v '^$')
flags=''
for name in $exports; do flags="$flags -Wl,--export=$name"; done

"$WASI_SDK/bin/clang" --target=wasm32-wasip1 -mexec-model=reactor $OPT -flto -std=c11 \
  -D_POSIX_C_SOURCE=200809L -DNDEBUG -fno-exceptions \
  -I../src -I../include \
  lib/tree-sitter.c ../src/lib.c \
  -Wl,--export-memory -Wl,--export-table -Wl,--growable-table \
  -Wl,--export=__stack_pointer -Wl,--strip-debug $flags \
  -o lib/web-tree-sitter.wasm
printf 'web-tree-sitter.wasm: %s raw, %s gzip -9\n' \
  "$(wc -c < lib/web-tree-sitter.wasm)" "$(gzip -9nc lib/web-tree-sitter.wasm | wc -c)"
