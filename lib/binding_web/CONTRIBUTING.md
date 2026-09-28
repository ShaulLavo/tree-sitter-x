# Contributing

## Code of Conduct

Contributors to Tree-sitter should abide by the [Contributor Covenant][covenant].

## Developing Web-tree-sitter

### Prerequisites

To make changes to Web-tree-sitter, you should have:

1. A [Rust toolchain][rust], for running the xtasks necessary to build the library.
2. Node.js and NPM (or an equivalent package manager).
3. Nothing else: `cargo xtask build-wasm` compiles the library with clang from the [WASI SDK][wasi-sdk] and optimizes it
with binaryen's `wasm-opt`, downloading both on first use (or set `TREE_SITTER_WASI_SDK_PATH` and
`TREE_SITTER_BINARYEN_PATH`).

### Building

Clone the repository:

```sh
git clone https://github.com/tree-sitter/tree-sitter
cd tree-sitter/lib/binding_web
```

Install the necessary dependencies:

```sh
npm install
```

Build the library:

```sh
npm run build
```

Note that the build process requires a Rust toolchain to be installed. If you don't have one installed, you can install it
by visiting the [Rust website][rust] and following the instructions there.

> [!NOTE]
> By default, the build process will emit an ES6 module. If you need a CommonJS module, export `CJS` to `true`, or just
> run `CJS=true npm run build` (or the equivalent command for Windows).

> [!TIP]
> To build the library with debug information, you can run `npm run build:debug`. The `CJS` environment variable is still
> taken into account.

### Putting it together

#### The C side

There are several components that come together to build the final JS and Wasm files. First, the xtask located at
`xtask/src/build_wasm.rs` from the root directory compiles the Wasm module with clang from the WASI SDK. It is output into
the local `lib` folder, and loaded by [`src/wasi-module.ts`][wasi-module.ts] (through [`src/bindings.ts`][bindings.ts]),
which also links grammar modules into it. The C code that
is compiled into the Wasm module is located in at [`lib/tree-sitter.c`][tree-sitter.c], and contains all the necessary
glue code to interact with the JS environment. If you need to update the imported functions from the tree-sitter library,
or anywhere else, you must update [`lib/exports.txt`][exports.txt]. Lastly, the type information for the Wasm module is
located at [`lib/tree-sitter.d.ts`][tree-sitter.d.ts], and can be updated by running `cargo xtask build-wasm --emit-tsd`
from the root directory.

#### The TypeScript side

The TypeScript library is a higher level abstraction over the Wasm module, and is located in `src`. This is where the
public API is defined, and where the Wasm module is loaded and initialized. The TypeScript library is built into a single
ES6 (or CommonJS) module, and is output into the same directory as `package.json`. If you need to update the public API,
you can do so by editing the files in `src`.

If you make changes to the library that require updating the type definitions, such as adding a new public API method,
you should run:

```sh
npm run build:dts
```

This uses [`dts-buddy`][dts-buddy] to generate `web-tree-sitter.d.ts` from the public types in `src`. Additionally, a sourcemap
is generated for the `.d.ts` file, which enables `go-to definition` and other editor integrations to take you straight
to the TypeScript source code.

This TypeScript code is then compiled into a single JavaScript file with `esbuild`. The build configuration for this can
be found in [`script/build.js`][build.js], but this shouldn't need to be updated. This step is responsible for emitting
the final JS and Wasm files that are shipped with the library, as well as their sourcemaps.

### Testing

Before you can run the tests, you need to fetch and build some upstream grammars that are used for testing.
Run this in the root of the repository:

```sh
cargo xtask fetch-fixtures
```

Optionally, to update the generated parser.c files:

```sh
cargo xtask generate-fixtures
```

Then you can build the Wasm modules:

```sh
cargo xtask generate-fixtures --wasm
```

Now, you can run the tests. In the `lib/binding_web` directory, run:

```sh
npm test
```

> [!NOTE]
> We use `vitest` to run the tests. If you want to run a specific test, you can use the `-t` flag to pass in a pattern.
> If you want to run a specific file, you can just pass the name of the file as is. For example, to run the `parser` tests
> in `test/parser.test.ts`, you can run `npm test parser`. To run tests that have the name `descendant` somewhere, run
> `npm test -- -t descendant`.
>
> For coverage information, you can run `npm test -- --coverage`.

### Debugging

You might have noticed that when you ran `npm build`, the build process generated a [sourcemap][sourcemap],
`web-tree-sitter.js.map`, which can be used to debug the library in the browser. `npm run build:debug` builds the Wasm module
with debug information.

#### Tweaking the Wasm build

If you're trying to tweak the Wasm build, or are trying to debug an issue, the code for this lies in `xtask/src/build_wasm.rs`
file mentioned earlier, namely in the `run_wasm` function.

[bindings.ts]: src/bindings.ts
[wasi-module.ts]: src/wasi-module.ts
[wasi-sdk]: https://github.com/WebAssembly/wasi-sdk
[build.js]: script/build.js
[covenant]: https://www.contributor-covenant.org/version/1/4/code-of-conduct
[dts-buddy]: https://github.com/Rich-Harris/dts-buddy
[exports.txt]: lib/exports.txt
[rust]: https://www.rust-lang.org/tools/install
[sourcemap]: https://developer.mozilla.org/en-US/docs/Glossary/Source_map
[tree-sitter.c]: lib/tree-sitter.c
[tree-sitter.d.ts]: lib/tree-sitter.d.ts
