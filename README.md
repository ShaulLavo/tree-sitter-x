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

## What we fixed

- Finding "the first child at this position" failed when the position was inside invisible
  trailing content, like the blank lines between markdown paragraphs. Both `Node` and
  `TreeCursor` versions now find the next child.

## Build and test

```sh
cd lib/binding_web
npm install
npm run build   # needs the WASI SDK; set WASI_SDK, or it uses the tree-sitter CLI's copy
npm test        # upstream's tests, plus a comparison against the original web-tree-sitter
```

`node script/bench.mjs <grammar.wasm> <file>` compares speed with the original.
