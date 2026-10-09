# Tree-sitter-x for JavaScript

WASI bindings for [tree-sitter-x](https://github.com/ShaulLavo/tree-sitter-x), with shared text buffers and C extensions.

## Setup

```sh
npm install @singapore-editor/tree-sitter-x
```

```js
import { Parser, Language } from '@singapore-editor/tree-sitter-x';
await Parser.init();
```

CommonJS is also supported:

```js
const { Parser, Language } = require('@singapore-editor/tree-sitter-x');
Parser.init().then(() => {
  const parser = new Parser();
});
```

The package includes `web-tree-sitter.wasm`. Browser bundles must serve that asset alongside the runtime or pass its bytes to `Parser.init({ wasmBinary })`.

Import `@singapore-editor/tree-sitter-x/debug` for the build with debug symbols and assertions.

### Basic Usage

First, create a parser:

```js
const parser = new Parser();
```

Then assign a language to the parser. Tree-sitter languages are packaged as individual `.wasm` files (more on this below):

```js
const { Language } = require('@singapore-editor/tree-sitter-x');
const JavaScript = await Language.load('/path/to/tree-sitter-javascript.wasm');
parser.setLanguage(JavaScript);
```

Now you can parse source code:

```js
const sourceCode = 'let x = 1; console.log(x);';
const tree = parser.parse(sourceCode);
```

and inspect the syntax tree.

```javascript
console.log(tree.rootNode.toString());

// (program
//   (lexical_declaration
//     (variable_declarator (identifier) (number)))
//   (expression_statement
//     (call_expression
//       (member_expression (identifier) (property_identifier))
//       (arguments (identifier)))))

const callExpression = tree.rootNode.child(1).firstChild;
console.log(callExpression);

// { type: 'call_expression',
//   startPosition: {row: 0, column: 16},
//   endPosition: {row: 0, column: 30},
//   startIndex: 0,
//   endIndex: 30 }
```

### Query capture ranges

Use `Query.captureRanges(node, options)` when you need capture names and text ranges for highlighting. Each `QueryCaptureRange` has `patternIndex`, `name`, `startIndex`, `endIndex` and the pattern's query properties. Indices count UTF-16 code units, as JavaScript string indices do.

```js
import { Query } from '@singapore-editor/tree-sitter-x';

const query = new Query(JavaScript, '(identifier) @variable');
for (const capture of query.captureRanges(tree.rootNode)) {
  console.log(capture.name, sourceCode.slice(capture.startIndex, capture.endIndex));
}
query.delete();
```

Captures follow the order of `query.matches(node, options).flatMap(match => match.captures)`. Text predicates evaluate the complete match before it is flattened. The method accepts the same `QueryOptions` as `matches`, and `didExceedMatchLimit()` reports its match limit status. Predicate-free patterns produce ranges directly from native records. Use `matches` when you need grouped captures and syntax nodes, or `captures` when you need individual captures in capture order.

### Editing

If your source code *changes*, you can update the syntax tree. This will take less time than the first parse.

```javascript
// Replace 'let' with 'const'
const newSourceCode = 'const x = 1; console.log(x);';

tree.edit({
  startIndex: 0,
  oldEndIndex: 3,
  newEndIndex: 5,
  startPosition: {row: 0, column: 0},
  oldEndPosition: {row: 0, column: 3},
  newEndPosition: {row: 0, column: 5},
});

const newTree = parser.parse(newSourceCode, tree);
```

### Parsing Text From a Custom Data Structure

If your text is stored in a data structure other than a single string, you can parse it by supplying a callback to `parse`
instead of a string:

```javascript
const sourceLines = [
  'let x = 1;',
  'console.log(x);'
];

const tree = parser.parse((index, position) => {
  let line = sourceLines[position.row];
  if (line) return line.slice(position.column);
});
```

### Getting the `.wasm` language files

There are several options on how to get the `.wasm` files for the languages you want to parse.

#### From npmjs.com

The recommended way is to just install the package from npm. For example, to parse JavaScript, you can install the `tree-sitter-javascript`
package:

```sh
npm install tree-sitter-javascript
```

Then you can find the `.wasm` file in the `node_modules/tree-sitter-javascript` directory.

#### From GitHub

You can also download the `.wasm` files from GitHub releases, so long as the repository uses our reusable workflow to publish
them.
For example, you can download the JavaScript `.wasm` file from the tree-sitter-javascript [releases page][gh release js].

#### Generating `.wasm` files

You can also generate the `.wasm` file for your desired grammar. Shown below is an example of how to generate the `.wasm`
file for the JavaScript grammar.

> [!NOTE]
> Since v0.26.1, `tree-sitter build --wasm` uses [wasi-sdk][] and will automatically download it on first use.
> No additional tools need to be installed.

First install `tree-sitter-cli`, and the tree-sitter language for which to generate `.wasm`
(`tree-sitter-javascript` in this example):

```sh
npm install --save-dev tree-sitter-cli tree-sitter-javascript
```

Then just use tree-sitter cli tool to generate the `.wasm`.

```sh
npx tree-sitter build --wasm node_modules/tree-sitter-javascript
```

If everything is fine, file `tree-sitter-javascript.wasm` should be generated in current directory.

### Wasm compatibility

`web-tree-sitter` supports the same parser ABI versions as the corresponding tree-sitter library:

| web-tree-sitter version | Min parser ABI version | Max parser ABI version |
|-------------------------|------------------------|------------------------|
| 0.24.x                  | 13                     | 14                     |
| >= 0.25.0               | 13                     | 15                     |

> [!WARNING]
> Some prebuilt `.wasm` files use an older dynamic-linking format that newer versions of `web-tree-sitter` cannot
> load, even if their parser ABI is supported. Rebuild these files using a current tree-sitter CLI.

### Running .wasm in Node.js

Notice that executing `.wasm` files in Node.js is considerably slower than running [Node.js bindings][node bindings].
However, this could be useful for testing purposes:

```javascript
const Parser = require('@singapore-editor/tree-sitter-x');

(async () => {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Parser.Language.load('tree-sitter-javascript.wasm');
  parser.setLanguage(Lang);
  const tree = parser.parse('let x = 1;');
  console.log(tree.rootNode.toString());
})();
```

### Loading a pre-compiled WebAssembly module

Some environments, such as Cloudflare Workers and Vercel Edge Functions, import
`.wasm` files as `WebAssembly.Module` objects. You can pass those modules to `Language.loadSync`:

```javascript
import treeSitterJavaScript from 'tree-sitter-javascript.wasm';
// treeSitterJavaScript is of type `WebAssembly.Module`
const JavaScript = Language.loadSync(treeSitterJavaScript);
parser.setLanguage(JavaScript);
```

### Running .wasm in browser

`web-tree-sitter` can run in the browser, but there are some common pitfalls.

#### Loading the .wasm file

`web-tree-sitter` needs to load the `tree-sitter.wasm` file. By default, it assumes that this file is available in the
same path as the JavaScript code. Therefore, if the code is being served from `http://localhost:3000/bundle.js`, then
the Wasm file should be at `http://localhost:3000/tree-sitter.wasm`.

For server side frameworks like NextJS, this can be tricky as pages are often served from a path such as
`http://localhost:3000/_next/static/chunks/pages/index.js`. The loader will therefore look for the Wasm file at
`http://localhost:3000/_next/static/chunks/pages/tree-sitter.wasm`. The solution is to pass a `locateFile` function in
the `moduleOptions` argument to `Parser.init()`:

```javascript
await Parser.init({
  locateFile(scriptName: string, scriptDirectory: string) {
    return scriptName;
  },
});
```

`locateFile` takes in two parameters, `scriptName`, i.e. the Wasm file name, and `scriptDirectory`, i.e. the directory
where the loader expects the script to be. It returns the path where the loader will look for the Wasm file. In the NextJS
case, we want to return just the `scriptName` so that the loader will look at `http://localhost:3000/tree-sitter.wasm`
and not `http://localhost:3000/_next/static/chunks/pages/tree-sitter.wasm`.

`Parser.init` also accepts `wasmBinary`: the runtime's bytes or a compiled `WebAssembly.Module`, instead of fetching it.

#### "Can't resolve 'fs' in 'node_modules/web-tree-sitter"

Most bundlers will notice that the `web-tree-sitter.js` file is attempting to import `fs`, i.e. node's file system library.
Since this doesn't exist in the browser, the bundlers will get confused. For Webpack, you can fix this by adding the
following to your webpack config:

```javascript
{
  resolve: {
    fallback: {
      fs: false
    }
  }
}
```

[gh release]: https://github.com/tree-sitter/tree-sitter/releases/latest
[gh release js]: https://github.com/tree-sitter/tree-sitter-javascript/releases/latest
[node bindings]: https://github.com/tree-sitter/node-tree-sitter
[npm module]: https://www.npmjs.com/package/@singapore-editor/tree-sitter-x
[wasi-sdk]: https://github.com/WebAssembly/wasi-sdk
