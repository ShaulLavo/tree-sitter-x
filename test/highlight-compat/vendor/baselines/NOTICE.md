# Baseline asset provenance

These assets are offline inputs to diagnostic candidate profiles. `assets.json` records each asset's language, role, relative path, original manifest path and SHA-256. `src/baselines/assets.ts` checks those associations and bytes against `manifest/tree-sitter-languages.json`.

## Product parsers and queries

The product snapshot is Platform commit `7f0dfc9e29fa9e3ee90c981147f77f6fcb656481`, as recorded in the structural manifest. Parser/query identities come from that manifest; acquisition copied bytes without rewriting line endings.

- `tree-sitter-javascript` is the pinned JavaScript parser and JSX query. Its MIT license is `tree-sitter-javascript/LICENSE`.
- `tree-sitter-typescript` contains the pinned TypeScript and TSX parsers. Its MIT license is `tree-sitter-typescript/LICENSE`.
- `tree-sitter-json` contains the pinned JSON parser and highlights query. Its MIT license is `tree-sitter-json/LICENSE`.
- `queries/javascript-highlights.scm` and `queries/typescript-highlights.scm` are the product's query files. They derive from the MIT-licensed JavaScript and TypeScript grammars above. The product source and hash for each appear in `assets.json`; shared query files retain each language association.
- `tree-sitter-md` contains both pinned grammar and native resolver Wasm. The manifest pins package 0.1.1, commit `ff455a7dd3dc6177ddaf6879de462cecc34df73f`. Platform later moved to 0.1.2; these bytes retain the manifest's 0.1.1 identity. Acquisition used the published 0.1.1 tarball, SHA-256 `54f7a66e6d341af929dbea3c39fb6ca5751dff73d41009ba5434fa5a9da62e66`, and verified both Wasm files against the manifest. The package MIT license is `tree-sitter-md/LICENSE`; `tree-sitter-md/NOTICE.md` and `tree-sitter-md/licenses/` preserve its bundled third-party notices.

Markdown has no external highlights query or configured markdown_inline parser in this snapshot. Its native `MarkdownDocument.highlights` resolver is vendored for identity coverage, not interpreted as ordinary captures. The ordinary-capture Markdown baseline reports unsupported.

## VS Code TypeScript query

`vscode-typescript.scm` is the exact `src/vs/editor/common/languages/highlights/typescript.scm` blob from microsoft/vscode commit `f39c7109bf651845855cbef5af2e91b2c9bd0a74`. SHA-256 is `fc3d24706daa63b470559f64796933a10d266742053aeeb4c069a598543a1510`. `VSCODE-LICENSE.txt` is that commit's MIT license.

The acquisition used existing read-only checkouts for product and VS Code files. Tests, golden updates and report generation read only these vendored bytes and require no external checkout or network.
