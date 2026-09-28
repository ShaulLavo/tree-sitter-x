# tree-sitter-x

A fork of [tree-sitter](https://github.com/tree-sitter/tree-sitter). It is built mainly for
[Fregat](https://github.com/ShaulLavo/fregat), but anyone can use it. Everything else works the
same as upstream.

## What we changed

- **No Emscripten.** The web version (`web-tree-sitter`) is built with plain clang from the WASI
  SDK. Same API, so it drops in for the original. Grammars built by the tree-sitter CLI load
  unchanged.
- **Faster typing on big files.** New `TextBuffer`: keep a document's text inside the parser and
  edit it in place. The parser reads it directly instead of asking JavaScript for text. On a 1 MB
  markdown file, reparsing after a keystroke goes from 0.8 ms to 0.35 ms.
- **C extensions.** `loadExtension(wasm)` loads your own C code, built like a grammar, into
  the same memory as the parser. It can call tree-sitter's C API on trees directly, with no
  copying and no JavaScript in between. Fregat's markdown support uses this.
- **Bigger stack.** Grammars and extensions get a 1 MB stack (the default was 64 KB, too small
  for deeply nested markdown). Running out stops with an error.

## What we fixed

- Finding "the first child at this position" failed when the position was inside invisible
  trailing content, like the blank lines between markdown paragraphs. Both `Node` and
  `TreeCursor` versions now find the next child.

## Install

Install the WASI JavaScript runtime from npm:

```sh
npm install @singapore-editor/tree-sitter-x
```

```js
import { Parser, Language, TextBuffer } from '@singapore-editor/tree-sitter-x'
```

Projects that import `web-tree-sitter` can install the runtime under that dependency name:

```json
"web-tree-sitter": "npm:@singapore-editor/tree-sitter-x@0.28.0"
```

CI also publishes built artifacts on the `web-tree-sitter` Git branch after source checks pass.
Run `sh lib/binding_web/script/package-branch.sh --push` to refresh that branch manually.

## Build and test

```sh
cd lib/binding_web
npm install
npm run build   # needs Rust: `cargo xtask build-wasm` downloads the WASI SDK and binaryen
npm test        # upstream's tests, plus a comparison against the original web-tree-sitter
```

`node script/bench.mjs <grammar.wasm> <file>` compares speed with the original.
