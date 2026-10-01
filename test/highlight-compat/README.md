# highlight-compat

Development harness that compares TextMate scope and style output between reference profiles (`<product|raw|shiki-api|vscode>[:variant]`) and candidates (`native`, `baseline:<name>`). The plan is `docs/plans/textmate-scope-compatibility.md`.

Build this checkout's web binding before running the baseline tests. Rust 1.98.1, Node.js 24.21.0 and npm are required. The harness engines field, lock metadata and CI pin this same Node runtime; CI also pins the tested Rust release. The WASI build downloads its pinned SDK and Binaryen tools when the build cache is empty. Tests and regeneration use only local assets.

```sh
# From the repository root:
cargo +1.98.1 xtask build-wasm
(cd lib/binding_web && npm ci && npm run build:ts)
cd test/highlight-compat
npm ci
npm test                                   # read-only: fails on any golden difference
npm run test:platform                      # opt-in: manifest checks against a live Platform checkout (PLATFORM_ROOT)
npx tsc --noEmit
npm run compare -- ref.json cand.json [--source file] [--theme id] [--runs n] [--json out.json]
npm run golden:update -- --profile product # updates one reference profile
npm run report:references                  # rewrites reports/reference-differences.md
npm run report:historical                  # grades historical scope annotations
npm run report:baselines                   # scores both candidate baselines
npm run artifacts:check                    # two temp regenerations, no checkout writes
npm run artifacts:update                   # replaces generated goldens and reports
```

The tracked-import guard follows harness source dependencies. `generated-inputs.json` declares build outputs with a build command and tracked sources. Once a declared artifact is present, gitignored and untracked, it is an opaque leaf; its internal references are the build’s responsibility. Unlisted ignored outputs fail the guard.

## Result contract

`src/schema.ts` defines `DocumentResult`. `src/validate.ts` is the JSON boundary; everything past it trusts the type.

- Offsets are half-open UTF-16 code units into the exact source string. Line endings and BOMs are never normalised.
- `sourceSha256` hashes the source as WTF-8. For well-formed text that equals `sha256sum` of the UTF-8 file; lone surrogates stay distinct from U+FFFD.
- A `complete` result's scope, metadata and style tracks each tile `[0, sourceLength)` with raw, uncoalesced token spans. An empty source has zero spans.
- Scope names, paths, language ids and styles are interned in first-use order, and the validator rejects any other order. Build results with `ResultBuilder` (`src/build.ts`) so equal content always means equal JSON.
- Scope names contain no whitespace. Colours are lowercase `#rrggbb` or `#rrggbbaa`. An absent style field inherits the theme default; `fontStyle: 'reset'` is an explicit empty font style. Styles compare by representation, so adapters resolve theme defaults the same way on both sides: an absent foreground and an explicit default colour disagree.
- Any other status carries no spans and at least one diagnostic. Such results are never comparable and never become goldens (`unsupported` is the one exception that may be recorded).
- Timing stays out of results (`ResultTiming` is a separate sidecar); `engine` holds identities only.

## Goldens

`goldens/<profileId>/<languageId>/<fixtureId>.json`, written by `golden:update` or `artifacts:update` from producers registered in `src/golden-producers.ts`. The update validates every case against its source and refuses non-reference profiles, failed reference work and fixture paths that collide as file and directory. It stages the new profile tree and swaps it in whole, so a failure writes nothing and stale files disappear. The read-only check (`tests/goldens.test.ts`) requires each registered producer to yield exactly the committed goldens of its own profile.

`artifacts:update` creates its first fresh reference tree before mandatory self-tests. The scope/theme checks read that temporary tree, so missing or stale committed goldens can be regenerated. Publication copies and verifies both new directories in checkout-local staging before any rename, retains both old directories until installation succeeds, and restores them if a copy or rename fails. Artifact traversal rejects symlinks and unsupported filesystem entries.

## Reference oracles

`src/oracles/` turns a source string into a `DocumentResult` for each implemented reference profile. Every call runs in a fresh worker (`src/oracles/run.ts`) under a hard deadline, and returns a validated result or `timeout`/`error` with a diagnostic, never partial spans. A reply waits for natural worker exit before releasing its concurrency slot. An answered worker that retains handles is terminated after a 1000 ms teardown grace period and returns an error diagnostic; the no-answer hard deadline remains 60000 ms. Nothing is shared between calls: each builds its own engine, registry or highlighter and loads its own themes.

| Profile | What it runs |
| --- | --- |
| `raw` | vscode-textmate 9.3.2 with vscode-oniguruma 2.0.1. `tokenizeLine` on every physical line for scopes; `tokenizeLine2` metadata for styles, one pass per theme. Grammars are the product's registration closure from `@shikijs/langs` 4.4.3; themes get a default rule from `editor.foreground`/`editor.background`. |
| `raw:shiki-fork` | The same driver on `@shikijs/vscode-textmate` 10.0.2, same Oniguruma build. Goldens exist only where it differs from `raw`. |
| `shiki-api` | Shiki `codeToTokensBase` with `includeExplanation: 'scopeName'` for scopes, `tokenizeMaxLineLength` at the product's 20000 and `tokenizeTimeLimit: 0`, because the API never reports a line that stopped early. |
| `product` | A port of the Editor's scoped incremental tokenizer (`src/oracles/product/`, from Platform 7f0dfc9e), registering the document grammar's module only. Scopes are read from inside the tokenizer before packing; styles are its own theme resolution. |
| `product:warm` | The same, after registering every language the grammar lazily embeds. |

Conventions shared by every profile, so a difference means the engines differ:

- Lines split on LF and CRLF, as the product and Shiki split them. A lone CR stays in its line as text. Each terminator is its own span with an empty scope path and an empty style; the tokenizer's synthetic end-of-line unit is clipped. The product's splitLines also strips a CR that ends the final line with no LF after it; that unit gets no product token, so the adapter tiles it like a terminator (the named difference `final-lone-cr-dropped`).
- Colours are lowercase `#rrggbb[aa]` (shorthand expanded). An empty colour is an absent foreground. Font style 0 is absent, because no oracle theme sets a default font style (`themeModule` throws if one does). Background is not recorded: neither the product nor Shiki's token API applies it.
- Themes: `github-dark`, `light-plus`, `dracula`, `vesper` (`ORACLE_THEMES`).

Each file under `src/oracles/product/` that starts with `// Port of Platform <path>` records the blob sha256 it ports; `tests/product-port.test.ts` fails when that hash differs from the cited source in `manifest/product-profile.json`. Re-port the file when it does.

## Oracle conformance lane

`vendor/vscode-textmate/` holds the first-mate, suite1 and while suites from vscode-textmate fbe49961, byte-exact and hash-checked against `manifest/fixture-sources.json` (see its NOTICE). `raw` and `raw:shiki-fork` run the 94 selected cases and must reproduce the suites' tokens, except the cases `src/oracles/conformance-expectations.ts` names with a cause; those must reproduce exactly the tokens pinned there for each differing line, and every other line must still match the suite. These grammars are artificial and never count toward a language's coverage.

## Original fixtures and the reference report

`fixtures/original/<language>/` holds byte-exact adversarial inputs (empty lines in open constructs, the 20000-unit line cap, EOL variants, BOM, Unicode, Markdown fences); `tests/original-fixtures.test.ts` pins the property each one exists for. `npm run report:references` compares every pair of reference profiles over them and the conformance cases, and writes `reports/reference-differences.md`. Each observed difference must belong to exactly one named expectation in `src/oracles/reference-expectations.ts`, which claims source lines per input and the values it accepts; a mismatch outside those lines, on a terminator, or with other values is unexplained. Each claim must be observed; `npm test` fails otherwise, and when the committed report is stale.

## Capture baselines and generated gate evidence

`src/baselines/` executes candidate queries through this checkout's built `lib/binding_web/web-tree-sitter.js`. `baseline:captures` maps the product's ordinary captures through the versioned table in `capture-map.ts`. `baseline:vscode-ts` preserves the pinned VS Code query's TextMate capture names. Neither baseline can write goldens.

`vendor/baselines/NOTICE.md` records source identities and licenses. Tests check every pilot parser/query against `manifest/tree-sitter-languages.json`, and check the VS Code query against its pinned hash. Markdown stays at tree-sitter-md 0.1.1. That manifest uses native `MarkdownDocument.highlights` without an external query or inline parser, so ordinary-capture Markdown is unsupported. The JS/TS/TSX queries require local-variable analysis for two patterns. Those patterns are excluded with line numbers and reasons. Unknown predicates and directives fail.

Composition orders active captures by start ascending, end descending, accepted query-pattern index, declared capture-name ordinal, then code-point capture name. Match enumeration does not decide ties. The root scope is first; duplicates remain. Every LF/CRLF separator has empty scopes and styles. Styles use the pinned TextMate theme matcher with raw/product normalization, independently checked by repainting reference scope paths.

`reports/baselines.md` separates real and original fixtures, gives UTF-16 and file-macro denominators, and lists each unsupported or failed comparison. `reports/historical-expectations.md` grades the historical annotations against raw/product goldens and never gates native acceptance.

`artifacts:check` runs the mandatory self-tests, regenerates every reference golden and report twice in temporary trees, and requires identical content hashes and bytes. It generates `reports/phase-1-gate.md` from those runs and Vitest test-case counts, then checks the entire generated tree against the checkout. Missing, extra or edited artifacts fail. `artifacts:update` uses the same checks before replacing the generated directories. Normal `npm test` and `artifacts:check` are read-only. Neither command needs a Platform checkout or network access.
