# highlight-compat

Development harness that compares TextMate scope and style output between reference profiles (`<product|raw|shiki-api|vscode>[:variant]`) and candidates (`native`, `baseline:<name>`). The plan is `docs/plans/textmate-scope-compatibility.md`.

```sh
npm ci
npm test                                   # read-only: fails on any golden difference
npm run test:platform                      # opt-in: manifest checks against a live Platform checkout (PLATFORM_ROOT)
npx tsc --noEmit
npm run compare -- ref.json cand.json [--source file] [--theme id] [--runs n] [--json out.json]
npm run golden:update -- --profile product # the only writer; reference profiles only
npm run report:references                  # rewrites reports/reference-differences.md
```

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

`goldens/<profileId>/<languageId>/<fixtureId>.json`, written only by `golden:update` from producers registered in `src/golden-producers.ts`. The update validates every case against its source and refuses non-reference profiles, failed reference work and fixture paths that collide as file and directory. It stages the new profile tree and swaps it in whole, so a failure writes nothing and stale files disappear. The read-only check (`tests/goldens.test.ts`) requires each registered producer to yield exactly the committed goldens of its own profile.

## Reference oracles

`src/oracles/` turns a source string into a `DocumentResult` for each implemented reference profile. Every call runs in a fresh worker (`src/oracles/run.ts`) under a hard deadline, and returns a validated result or `timeout`/`error` with a diagnostic, never partial spans. Nothing is shared between calls: each builds its own engine, registry or highlighter and loads its own themes.

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
