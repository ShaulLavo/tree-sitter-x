#!/bin/sh
# Builds lib/web-tree-sitter.wasm with the WASI SDK: the runtime, the binding glue and
# the libc subset grammars may import, with no Emscripten runtime. src/wasi-module.ts
# instantiates it and links grammar modules into its memory and function table.
# Grammars and extensions run on the runtime's stack: 1 MB, placed first so an overflow
# traps instead of writing over data (wasm-ld's default is 64 KB after the data).
set -eu
cd "$(dirname "$0")/.."
: "${WASI_SDK:=$HOME/.cache/tree-sitter/wasi-sdk}"
: "${OPT:=-O3}"
# wasm-opt from binaryen, which the tree-sitter CLI also caches; skipped when absent.
: "${WASM_OPT:=$HOME/.cache/tree-sitter/binaryen/bin/wasm-opt}"

# lib/extra-exports.txt: libc functions beyond wasm-stdlib/imports.txt that published
# grammars (Emscripten's runtime provided them implicitly) and extensions import.
exports=$(cat ../src/wasm-stdlib/imports.txt lib/extra-exports.txt lib/exports.txt | tr -d '", ' | grep -v '^$')
# The public C API, so extension modules (loadExtension) can work on trees directly.
api=$(grep -oE '\bts_[a-z0-9_]+\(' ../include/tree_sitter/api.h | tr -d '(' | sort -u | grep -v 'wasm')
exports="$exports $api"
flags=''
for name in $exports; do flags="$flags -Wl,--export=$name"; done

"$WASI_SDK/bin/clang" --target=wasm32-wasip1 -mexec-model=reactor $OPT -flto -std=c11 \
  -D_POSIX_C_SOURCE=200809L -DNDEBUG -fno-exceptions \
  -I../src -I../include \
  lib/tree-sitter.c ../src/lib.c \
  -Wl,--export-memory -Wl,--export-table -Wl,--growable-table \
  -Wl,-z,stack-size=1048576 -Wl,--stack-first \
  -Wl,--export=__stack_pointer -Wl,--strip-debug $flags \
  -o lib/web-tree-sitter.wasm
if [ -x "$WASM_OPT" ]; then
  "$WASM_OPT" $OPT --enable-bulk-memory --enable-mutable-globals --enable-sign-ext \
    --enable-nontrapping-float-to-int lib/web-tree-sitter.wasm -o lib/web-tree-sitter.wasm
else
  echo "wasm-opt not found at $WASM_OPT; the runtime is about 8 KB larger gzipped" >&2
fi
printf 'web-tree-sitter.wasm: %s raw, %s gzip -9\n' \
  "$(wc -c < lib/web-tree-sitter.wasm)" "$(gzip -9nc lib/web-tree-sitter.wasm | wc -c)"
