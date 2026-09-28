# tree-sitter-x

A fork of [tree-sitter](https://github.com/tree-sitter/tree-sitter), kept close to upstream so it
rebases cleanly. It changes two things: runtime fixes in `lib/src/`, and a web binding built
without Emscripten in `lib/binding_web/`. The binding keeps web-tree-sitter's API, so it replaces
the published package without code changes.

## Runtime fixes (`lib/src/`)

- `ts_tree_cursor_goto_first_child_for_byte`/`_point` returned -1, and `ts_node_first_child_for_byte`
  (and the named variant) a null node, when the goal fell in a hidden node's trailing invisible
  content, for example the blank lines a markdown grammar keeps inside hidden block rules.
  `crates/cli/src/tests/node_test.rs` covers both with a generated grammar; it fails without
  either fix.

Upstream's library test suite passes: `cargo test -p tree-sitter-cli --lib`, 311 tests, after
`cargo xtask fetch-fixtures` and `cargo xtask generate-fixtures`.

## Web binding without Emscripten (`lib/binding_web/`)

- `script/build-wasi.sh` compiles `lib/src/lib.c` and the binding glue (`lib/tree-sitter.c`) with
  clang from the WASI SDK. The glue's JS callbacks are explicit `env` imports; the runtime exports
  its memory, function table, stack pointer and the libc subset grammars may import
  (`lib/src/wasm-stdlib/imports.txt`, plus `__assert_fail`).
- `src/wasi-module.ts` replaces the Emscripten module: it instantiates the runtime, provides the
  helpers the bindings use (`getValue`/`setValue` over typed arrays, UTF-8 and UTF-16
  conversion), and links grammar side modules itself from their `dylink.0` section into the
  runtime's memory and table, including `GOT.mem`/`GOT.func` imports. Grammars built by the
  tree-sitter CLI load unchanged.
- `TextBuffer` (`src/text_buffer.ts`) keeps a document's UTF-16 text in the runtime's memory and
  edits it in place; `Parser#parse(buffer, oldTree)` reads it through `ts_parser_parse_utf16_wasm`
  with no JS callback per chunk. Trees parsed from a buffer read node text from it, so they see
  later edits.

Build with `npm run build` (`WASI_SDK` defaults to the CLI's cached SDK in
`~/.cache/tree-sitter/wasi-sdk`). `npm test` runs:

- upstream's binding tests, unchanged (111);
- `test/differential.test.ts`: every fixture grammar's corpus (16 grammars, about 1,500 examples)
  parsed with this build and with the published Emscripten build, requiring identical trees,
  identical trees and changed ranges after four seeded edits per example, and identical highlight
  captures (`cargo xtask generate-fixtures --wasm` builds the grammars);
- `test/text_buffer.test.ts`: buffer edits with surrogate pairs and growth, and trees parsed from a
  buffer equal to trees parsed from the string through 50 incremental edits.

## Measurements

`node script/bench.mjs <grammar.wasm> <document> [highlights.scm] --rounds 6`, Node 22.22.2, a
4-core cloud container, alternating builds. Medians in milliseconds; an edit is typing one
character and reparsing.

| Document | Build | Load | Full parse | Edit median | Edit p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| markdown, 46 KB | upstream, string | 23.8 | 4.9 | 0.092 | 0.182 |
| | x, string | 12.1 | 3.8 | 0.084 | 0.174 |
| | x, TextBuffer | | 4.1 | **0.058** | **0.118** |
| markdown, 1 MB | upstream, string | 40.2 | 92.4 | 0.821 | 1.400 |
| | x, string | 17.1 | 102.2 | 0.570 | 1.236 |
| | x, TextBuffer | | 77.7 | **0.352** | **0.698** |
| JavaScript, 156 KB | upstream, string | 29.3 | 50.4 | 6.302 | 24.344 |
| | x, string | 13.6 | 45.0 | 7.222 | 21.829 |
| | x, TextBuffer | | 25.4 | 5.070 | 19.416 |

Highlight captures over the 156 KB JavaScript file, median of nine runs per round: 92.7 ms
upstream, 87.5 ms (string) and 98.1 ms (TextBuffer) here. Run-to-run noise in this container is
around 20%; the markdown edit gains are larger than that, the JavaScript differences are not.
Load includes compiling the runtime and loading one grammar; it ran first-in-process for each
build.

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| Emscripten `web-tree-sitter.wasm` + `.js` (0.27.0) | 209,613 + 156,132 | 82,869 + 31,797 |
| WASI `web-tree-sitter.wasm` + `.js` | 262,236 + 99,050 | 97,085 + 20,146 |

The WASI runtime is larger because it is not run through `wasm-opt` and exports the whole libc
subset; the JS is smaller. Together they are 117.2 KB gzipped against 114.7 KB.
