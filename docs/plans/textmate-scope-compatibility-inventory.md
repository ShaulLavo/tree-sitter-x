# TextMate scope compatibility inventory

Status: **Approved.** Phase 0 target lock for the [native scope compatibility plan](textmate-scope-compatibility.md).

The product baseline is Fregat commit `7f0dfc9e29fa9e3ee90c981147f77f6fcb656481`, inspected on 2026-09-30. Editor source lives inside that checkout. This record changes no product code and makes no scope, visual, or performance parity claim.

## Manifest contract

The files in `test/highlight-compat/manifest/` separate product behavior, package assets, structural parsers, and candidate corpus provenance. Citations use paths relative to the named repository at its pinned commit. Installed package citations identify the package and its locked version. JSON records carry content hashes as well as repository revisions.

| File | Contents |
| --- | --- |
| `product-profile.json` | Product package lock, engine, registration policy, options, state, themes, and scoped-token conversion. |
| `assets.json` | Grammar and theme package paths and SHA-256 identities. No grammar or theme content is copied. |
| `tree-sitter-languages.json` | Structural parser revisions, ABI, Wasm and query identities, capture mappings, injection dependencies, and TextMate availability. |
| `fixture-sources.json` | Pinned candidate corpora, source and expected-output provenance, per-file license evidence, and redistribution decisions. |

The dependency-free extraction command reads Platform and installed assets. Its check mode compares cited source content, asset hashes, and registration closure with the committed JSON. It uses no network and writes no files. A moved Platform commit passes when those inputs are unchanged and prints the old and current commits. `--strict-commit` also treats a moved commit as drift.

```sh
node test/highlight-compat/manifest/extract-product-profile.mjs --check
```

A changed cited source file, package lock, catalog registration, or installed asset requires a reviewed manifest refresh. An unrelated Platform commit does not require regenerating these pinned manifests. Checks validate every structural `platformPath` against its installed bytes, including queries, the Markdown resolver, and the Tree-sitter runtime. Combined query hashes follow the recorded capture mapping. Missing or changed structural assets fail the check. A missing grammar or theme hash remains `unresolved`; it never means that the asset passed compatibility checks.

## Product profile

The product worker uses Shiki's registry with Oniguruma and the inlined Wasm import, at `editor/packages/editor/src/shiki/shiki.worker.ts:1-8`. The locked Shiki packages are version 4.4.3, with `@shikijs/vscode-textmate@10.0.2`; the manifest records their exact lock integrities and the 45-package dependency closure. `@shikijs/engine-javascript` is in that closure, but the worker selects Oniguruma. The decoded input is 466,610 bytes with SHA-256 `fd885c2d12e5951e59d761ebd4a006e06254b1491fd6f530c92b69fb4d8d77d9`, equal to the installed standalone `onig.wasm`.

The engine fingerprint includes the default executable entry and its supported local ESM dependency closure, as well as the inlined and standalone Wasm. Unrecognized dependency syntax fails extraction. Theme source fingerprints include `shiki/theme-extract.ts`, `theme.ts`, and the runtime local dependency `style-utils.ts`. The expanded 38-file source coverage matches the original pinned commit.

The Editor uses its own incremental scoped-token wrapper. Ordinary Shiki `codeToTokensBase` output is a separate reference profile. Shiki's token API defaults to line limit 0, time limit 500, and explanation disabled. Its HAST API merges whitespace and keeps same-style token merging disabled. Those API defaults do not configure the product wrapper; `product-profile.json` cites them separately.

The wrapper calls `grammar.tokenizeLine(line, state, 0)` at `scopedTokens.ts:48`, with no time limit. Empty lines return no tokens and retain the incoming state at `:38`. Nonempty lines over the configured length return one empty-scope token with theme-default style, preserve the incoming grammar state, and report `untokenized`, at `:41-46`. The strict comparison is `>`. `editor.maxTokenizationLineLength` defaults to 20,000 UTF-16 code units, at `packages/contracts/src/settings/keys.ts:973`; the worker owner validates the supplied value and falls back to 20,000 at `workerClient.ts:94,117-122`. The host reads the current application setting at `apps/web/src/lib/highlighting/state/service.ts:19`. A changed limit reopens the document at `workerClient.ts:518`.

Scope stacks stay ordered. The wrapper interns each stack using NUL-separated scope names and constructs linked `ScopePath` nodes, at `scopedTokens.ts:23-33`. It maps grammar tokens directly, with no adjacent-token coalescing, at `:48-55`. Theme changes update the interned styles without reparsing, at `:62-64`. Public tokens expose content, UTF-16 offset, foreground, and font style, at `:69-100`. The packed Editor conversion keeps ranges and rendered styles, including optional background and decorations, at `editor-tokens.ts:31-48,176-189`. Raw scope stacks and TextMate encoded language/token-type metadata do not cross that transport.

Language labels are trimmed and lowercased. `javascriptreact` resolves to `jsx`, and `typescriptreact` to `tsx`, at `editor/packages/highlighting/src/languages.ts:17-29`. The document map omits `javascript` and `typescript` so filename inference can distinguish JSX and TSX, at `:22-36`. The complete generated catalog and theme inventory follow below.

### Complete TextMate catalog

The product has **242 public language IDs**, **104 catalog aliases**, and **260 reachable grammar registrations**. The 18 additional registrations are dependency-only. The package also has 100 alias re-export modules. These are different inventories: a public catalog alias need not have its own package module. All 23 structural language IDs also exist as same-ID public TextMate entries.

Every grammar asset in the tables comes from `@shikijs/langs@4.4.3`. The exact package lock integrity is in `product-profile.json`; each file SHA-256 is in `assets.json`. A package version plus its individual file hash is the product grammar identity. Upstream grammar commit metadata, when established, lives in `fixture-sources.json`. Catalog availability is not verified scope parity.

The catalog order and aliases come from `shiki@4.4.3/dist/langs-bundle-full-xQVO1Cek.mjs:2-1318`. Per-registration records preserve eager imports, lazy embedding, external injection targets/selectors, and inline selectors. Lazy-language lists and selector text stay in the machine manifest; the table states their presence and counts. The worker loads dependency exports in order and deduplicates by name plus scope name, with first occurrence winning.

Fixture cells name reviewed candidates or explicit skips. Catalog samples are smoke inputs. Suite-local TextMate conformance grammars apply to the oracle, not to every named language. There is no cleared mixed Markdown fixture yet; the mixed pilot needs a new owned synthetic case with TypeScript fences.

| Language | Catalog aliases | TextMate asset | Structural parser | Embedding and injections | Assignment | Fixture candidates | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `abap` | None | `dist/abap.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `actionscript-3` | actionscript, as3 | `dist/actionscript-3.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ada` | None | `dist/ada.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ahk` | ahk1 | `dist/ahk.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ahk2` | None | `dist/ahk2.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `angular-html` | None | `dist/angular-html.mjs` | Absent | eager html, angular-expression, angular-let-declaration, angular-template, angular-template-blocks; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `angular-ts` | None | `dist/angular-ts.mjs` | Absent | eager angular-expression, angular-inline-style, angular-inline-template, angular-let-declaration, angular-template, angular-template-blocks | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `apache` | None | `dist/apache.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `apex` | None | `dist/apex.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `apl` | None | `dist/apl.mjs` | Absent | eager html, xml, css, javascript, json | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `applescript` | None | `dist/applescript.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ara` | None | `dist/ara.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `asciidoc` | adoc | `dist/asciidoc.mjs` | Absent | lazy 59 languages | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `asm` | None | `dist/asm.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `astro` | None | `dist/astro.mjs` | Yes | eager json, javascript, typescript, css, postcss, tsx; lazy 4 languages; inline 11 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `awk` | None | `dist/awk.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ballerina` | None | `dist/ballerina.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `bat` | batch, cmd | `dist/bat.mjs` | Absent | inline 1 | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `beancount` | None | `dist/beancount.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `berry` | be | `dist/berry.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `bibtex` | None | `dist/bibtex.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `bicep` | None | `dist/bicep.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `bird2` | bird | `dist/bird2.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `blade` | None | `dist/blade.mjs` | Absent | eager html-derivative, html, xml, sql, javascript, json, css; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `bsl` | 1c | `dist/bsl.mjs` | Absent | eager sdbl | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `c` | None | `dist/c.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `c3` | None | `dist/c3.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cadence` | cdc | `dist/cadence.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cairo` | None | `dist/cairo.mjs` | Absent | eager python | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `chapel` | chpl | `dist/chapel.mjs` | Absent | eager c | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `clarity` | None | `dist/clarity.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `clojure` | clj | `dist/clojure.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `cmake` | None | `dist/cmake.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cobol` | None | `dist/cobol.mjs` | Absent | eager html, java | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `codeowners` | None | `dist/codeowners.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `codeql` | ql | `dist/codeql.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `coffee` | coffeescript | `dist/coffee.mjs` | Absent | eager javascript | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `common-lisp` | lisp | `dist/common-lisp.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `coq` | None | `dist/coq.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cpp` | c++ | `dist/cpp.mjs` | Yes | eager cpp-macro, regexp, glsl | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `crystal` | None | `dist/crystal.mjs` | Absent | eager html, sql, css, c, javascript, shellscript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `csharp` | c#, cs | `dist/csharp.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `css` | None | `dist/css.mjs` | Yes | None declared | wave-1 | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `csv` | None | `dist/csv.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cue` | None | `dist/cue.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `cypher` | cql | `dist/cypher.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `d` | None | `dist/d.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `dart` | None | `dist/dart.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `dax` | None | `dist/dax.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `desktop` | None | `dist/desktop.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `diff` | None | `dist/diff.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `docker` | dockerfile | `dist/docker.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `dotenv` | None | `dist/dotenv.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `dream-maker` | None | `dist/dream-maker.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `edge` | None | `dist/edge.mjs` | Absent | eager typescript, html, html-derivative; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `elixir` | None | `dist/elixir.mjs` | Absent | eager html | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `elm` | None | `dist/elm.mjs` | Absent | eager glsl | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `emacs-lisp` | elisp | `dist/emacs-lisp.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `erb` | None | `dist/erb.mjs` | Absent | eager html, ruby; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `erlang` | erl | `dist/erlang.mjs` | Absent | eager markdown | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fennel` | None | `dist/fennel.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fish` | None | `dist/fish.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fluent` | ftl | `dist/fluent.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fortran-fixed-form` | f, for, f77 | `dist/fortran-fixed-form.mjs` | Absent | eager fortran-free-form; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fortran-free-form` | f90, f95, f03, f08, f18 | `dist/fortran-free-form.mjs` | Absent | inline 3 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `fsharp` | f#, fs | `dist/fsharp.mjs` | Absent | eager markdown | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `gdresource` | tscn, tres | `dist/gdresource.mjs` | Absent | eager gdshader, gdscript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `gdscript` | gd | `dist/gdscript.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `gdshader` | None | `dist/gdshader.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `genie` | None | `dist/genie.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `gherkin` | None | `dist/gherkin.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `git-commit` | None | `dist/git-commit.mjs` | Absent | eager diff | later-wave | VS Code skipped | loadable; scope pack unimplemented |
| `git-rebase` | None | `dist/git-rebase.mjs` | Absent | eager shellscript | later-wave | VS Code skipped | loadable; scope pack unimplemented |
| `gleam` | None | `dist/gleam.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `glimmer-js` | gjs | `dist/glimmer-js.mjs` | Absent | eager javascript, typescript, css, html; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `glimmer-ts` | gts | `dist/glimmer-ts.mjs` | Absent | eager typescript, css, javascript, html; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `glsl` | None | `dist/glsl.mjs` | Absent | eager c | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `gn` | None | `dist/gn.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `gnuplot` | None | `dist/gnuplot.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `go` | None | `dist/go.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `graphql` | gql | `dist/graphql.mjs` | Absent | eager javascript, typescript, jsx, tsx | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `groovy` | None | `dist/groovy.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `hack` | None | `dist/hack.mjs` | Absent | eager html, sql | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `haml` | None | `dist/haml.mjs` | Absent | eager javascript, css; lazy 4 languages | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `handlebars` | hbs | `dist/handlebars.mjs` | Absent | eager html, css, javascript, yaml | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `haskell` | hs | `dist/haskell.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `haxe` | None | `dist/haxe.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hcl` | None | `dist/hcl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hjson` | None | `dist/hjson.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hlsl` | None | `dist/hlsl.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `html` | None | `dist/html.mjs` | Yes | eager javascript, css; inline 1 | wave-1 | catalog skipped | loadable; scope pack unimplemented |
| `html-derivative` | None | `dist/html-derivative.mjs` | Absent | eager html; inline 1 | later-wave | VS Code skipped | loadable; scope pack unimplemented |
| `http` | None | `dist/http.mjs` | Absent | eager shellscript, json, xml, graphql | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hurl` | None | `dist/hurl.mjs` | Absent | eager graphql, xml, csv | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hxml` | None | `dist/hxml.mjs` | Absent | eager haxe | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `hy` | None | `dist/hy.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `imba` | None | `dist/imba.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ini` | properties | `dist/ini.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `java` | None | `dist/java.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `javascript` | js, cjs, mjs | `dist/javascript.mjs` | Yes | None declared | wave-1-distinct-javascript-jsx | VS Code selected; catalog selected; annotated JS selected | loadable; scope pack unimplemented |
| `jinja` | None | `dist/jinja.mjs` | Absent | eager jinja-html | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jison` | None | `dist/jison.mjs` | Absent | eager javascript; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `json` | None | `dist/json.mjs` | Yes | None declared | pilot | VS Code selected; catalog skipped | loadable; scope pack unimplemented |
| `json5` | None | `dist/json5.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jsonc` | None | `dist/jsonc.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jsonl` | None | `dist/jsonl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jsonnet` | None | `dist/jsonnet.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jssm` | fsl | `dist/jssm.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `jsx` | None | `dist/jsx.mjs` | JavaScript JSX variant | None declared | wave-1-distinct-javascript-jsx | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `julia` | jl | `dist/julia.mjs` | Absent | eager cpp, python, javascript, r, sql | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `just` | justfile | `dist/just.mjs` | Absent | eager shellscript, javascript, typescript, perl, python, ruby | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `kdl` | None | `dist/kdl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `kotlin` | kt, kts | `dist/kotlin.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `kusto` | kql | `dist/kusto.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `latex` | None | `dist/latex.mjs` | Absent | eager tex; lazy 16 languages | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `lean` | lean4 | `dist/lean.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `less` | None | `dist/less.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `liquid` | None | `dist/liquid.mjs` | Absent | eager html, css, json, javascript; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `llvm` | None | `dist/llvm.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `log` | None | `dist/log.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `logo` | None | `dist/logo.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `lua` | None | `dist/lua.mjs` | Yes | eager c | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `luau` | None | `dist/luau.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `make` | makefile | `dist/make.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `markdown` | md | `dist/markdown.mjs` | Yes | lazy 57 languages | mixed-pilot-typescript-fences | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `marko` | None | `dist/marko.mjs` | Absent | eager css, less, scss, typescript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `matlab` | None | `dist/matlab.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `mdc` | None | `dist/mdc.mjs` | Absent | eager markdown, yaml, html-derivative; selector L:text.html.markdown | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `mdx` | None | `dist/mdx.mjs` | Yes | lazy 42 languages | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `mermaid` | mmd | `dist/mermaid.mjs` | Absent | selector L:text.html.markdown | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `mipsasm` | mips | `dist/mipsasm.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `mojo` | None | `dist/mojo.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `moonbit` | mbt, mbti | `dist/moonbit.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `move` | None | `dist/move.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `narrat` | nar | `dist/narrat.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nextflow` | nf | `dist/nextflow.mjs` | Absent | eager nextflow-groovy | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nextflow-groovy` | None | `dist/nextflow-groovy.mjs` | Absent | None declared | later-wave | No cleared candidate | loadable; scope pack unimplemented |
| `nginx` | None | `dist/nginx.mjs` | Absent | eager lua | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nim` | None | `dist/nim.mjs` | Absent | eager c, html, xml, javascript, css, glsl, markdown | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nix` | None | `dist/nix.mjs` | Absent | eager markdown-nix | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nsis` | None | `dist/nsis.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `nushell` | nu | `dist/nushell.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `objective-c` | objc | `dist/objective-c.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `objective-cpp` | None | `dist/objective-cpp.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `ocaml` | None | `dist/ocaml.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `odin` | None | `dist/odin.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `openscad` | scad | `dist/openscad.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `org` | None | `dist/org.mjs` | Absent | eager javascript, typescript, tsx, java, python, regexp, css, lua, ini, make, perl, r, ruby, php, sql, vb, clojure, coffee, c, cpp, objective-c, diff, docker, go, groovy, less, scss, raku, rust, scala, shellscript, csharp, dart, nim, elixir, erlang, ocaml, zig, yaml, json, xml, xsl, markdown, html, git-commit, git-rebase, latex | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `pascal` | None | `dist/pascal.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `perl` | None | `dist/perl.mjs` | Absent | eager html, xml, css, javascript, sql | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `php` | None | `dist/php.mjs` | Yes | eager html, xml, sql, javascript, json, css | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `pkl` | None | `dist/pkl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `plsql` | None | `dist/plsql.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `po` | pot, potx | `dist/po.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `polar` | None | `dist/polar.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `postcss` | None | `dist/postcss.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `powerquery` | None | `dist/powerquery.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `powershell` | ps, ps1, pwsh | `dist/powershell.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `prisma` | None | `dist/prisma.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `prolog` | None | `dist/prolog.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `proto` | protobuf | `dist/proto.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `pug` | jade | `dist/pug.mjs` | Absent | eager javascript, css, html; lazy 4 languages | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `puppet` | None | `dist/puppet.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `purescript` | None | `dist/purescript.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `python` | py | `dist/python.mjs` | Yes | None declared | wave-1 | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `qml` | None | `dist/qml.mjs` | Absent | eager javascript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `qmldir` | None | `dist/qmldir.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `qss` | None | `dist/qss.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `r` | None | `dist/r.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `racket` | None | `dist/racket.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `raku` | perl6 | `dist/raku.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `razor` | None | `dist/razor.mjs` | Absent | eager html, csharp; inline 3 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `rbs` | ruby-signature | `dist/rbs.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `reg` | None | `dist/reg.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `regexp` | regex | `dist/regexp.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `rel` | None | `dist/rel.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `riscv` | None | `dist/riscv.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ron` | None | `dist/ron.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `rosmsg` | None | `dist/rosmsg.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `rst` | None | `dist/rst.mjs` | Absent | eager html-derivative, cpp, python, javascript, shellscript, yaml, cmake, ruby | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `ruby` | rb | `dist/ruby.mjs` | Absent | eager html, haml, xml, sql, graphql, css, cpp, c, javascript, shellscript, lua, yaml | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `rust` | rs | `dist/rust.mjs` | Yes | None declared | wave-1 | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `sas` | None | `dist/sas.mjs` | Absent | eager sql | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `sass` | None | `dist/sass.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `scala` | None | `dist/scala.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `scheme` | None | `dist/scheme.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `scss` | None | `dist/scss.mjs` | Absent | eager css | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `sdbl` | 1c-query | `dist/sdbl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `shaderlab` | shader | `dist/shaderlab.mjs` | Absent | eager hlsl | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `shellscript` | bash, sh, shell, zsh | `dist/shellscript.mjs` | Yes | None declared | wave-1 | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `shellsession` | console | `dist/shellsession.mjs` | Absent | eager shellscript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `smalltalk` | None | `dist/smalltalk.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `smithy` | None | `dist/smithy.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `solidity` | None | `dist/solidity.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `soy` | closure-templates | `dist/soy.mjs` | Absent | eager html; inline 1 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `sparql` | None | `dist/sparql.mjs` | Absent | eager turtle | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `splunk` | spl | `dist/splunk.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `sql` | None | `dist/sql.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `ssh-config` | None | `dist/ssh-config.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `stata` | None | `dist/stata.mjs` | Absent | eager sql | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `stylus` | styl | `dist/stylus.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `surrealql` | surql | `dist/surrealql.mjs` | Absent | eager javascript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `svelte` | None | `dist/svelte.mjs` | Yes | eager javascript, typescript, css, postcss; lazy 7 languages; inline 14 | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `swift` | None | `dist/swift.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `system-verilog` | None | `dist/system-verilog.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `systemd` | None | `dist/systemd.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `talonscript` | talon | `dist/talonscript.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `tasl` | None | `dist/tasl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `tcl` | None | `dist/tcl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `templ` | None | `dist/templ.mjs` | Absent | eager go, javascript, css | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `terraform` | tf, tfvars | `dist/terraform.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `tex` | None | `dist/tex.mjs` | Absent | eager r | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `toml` | None | `dist/toml.mjs` | Yes | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `ts-tags` | lit | `dist/ts-tags.mjs` | Absent | eager typescript, es-tag-css, es-tag-glsl, es-tag-html, es-tag-sql, es-tag-xml | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `tsv` | None | `dist/tsv.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `tsx` | None | `dist/tsx.mjs` | Yes | None declared | pilot | VS Code selected; TS maintainer skipped; catalog skipped | loadable; scope pack unimplemented |
| `turtle` | None | `dist/turtle.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `twig` | None | `dist/twig.mjs` | Absent | eager css, javascript, scss, php, python, ruby | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `typescript` | ts, cts, mts | `dist/typescript.mjs` | Yes | None declared | pilot | VS Code selected; TS maintainer selected; catalog selected | loadable; scope pack unimplemented |
| `typespec` | tsp | `dist/typespec.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `typst` | typ | `dist/typst.mjs` | Absent | eager bat, bibtex, c, clojure, coffee, cpp, css, csharp, dart, diff, docker, elixir, erlang, fsharp, git-commit, git-rebase, go, groovy, handlebars, html, ini, java, javascript, jsonc, json, julia, latex, less, log, lua, make, markdown, objective-c, perl, raku, php, powershell, pug, r, regexp, ruby, scss, sql, swift, xml, xsl, yaml, python, rust, scala, shellscript, typescript, tsx, twig, verilog, system-verilog, vb | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `v` | None | `dist/v.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vala` | None | `dist/vala.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vb` | None | `dist/vb.mjs` | Absent | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `verilog` | None | `dist/verilog.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vhdl` | None | `dist/vhdl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `viml` | vim, vimscript | `dist/viml.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vue` | None | `dist/vue.mjs` | Absent | eager css, javascript, typescript, json, html, html-derivative, markdown-vue, vue-directives, vue-interpolations, vue-sfc-style-variable-injection; lazy 14 languages | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vue-html` | None | `dist/vue-html.mjs` | Absent | eager javascript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vue-vine` | None | `dist/vue-vine.mjs` | Absent | eager css, scss, less, stylus, postcss, javascript | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `vyper` | vy | `dist/vyper.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wasm` | None | `dist/wasm.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wenyan` | 文言 | `dist/wenyan.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wgsl` | None | `dist/wgsl.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wikitext` | mediawiki, wiki | `dist/wikitext.mjs` | Absent | lazy 49 languages | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wit` | None | `dist/wit.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `wolfram` | wl | `dist/wolfram.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `xml` | None | `dist/xml.mjs` | Absent | eager java | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `xsl` | None | `dist/xsl.mjs` | Absent | eager xml | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `yaml` | yml | `dist/yaml.mjs` | Yes | None declared | later-wave | VS Code skipped; catalog skipped | loadable; scope pack unimplemented |
| `zenscript` | None | `dist/zenscript.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |
| `zig` | None | `dist/zig.mjs` | Absent | None declared | later-wave | catalog skipped | loadable; scope pack unimplemented |

### Dependency-only registrations

| Registration | TextMate asset | Embedding and injections | Status |
| --- | --- | --- | --- |
| `angular-expression` | `dist/angular-expression.mjs` | selector L:text.html -comment | dependency-only; loadable; scope pack unimplemented |
| `angular-inline-style` | `dist/angular-inline-style.mjs` | eager scss; injectTo source.ts.ng; selector L:source.ts#meta.decorator.ts -comment | dependency-only; loadable; scope pack unimplemented |
| `angular-inline-template` | `dist/angular-inline-template.mjs` | eager angular-html, angular-template; injectTo source.ts.ng; selector L:meta.decorator.ts -comment -text.html | dependency-only; loadable; scope pack unimplemented |
| `angular-let-declaration` | `dist/angular-let-declaration.mjs` | eager angular-expression; injectTo text.html.derivative, text.html.derivative.ng, source.ts.ng; selector L:text.html -comment -expression.ng -meta.tag -source.css -source.js | dependency-only; loadable; scope pack unimplemented |
| `angular-template` | `dist/angular-template.mjs` | eager angular-expression; injectTo text.html.derivative, text.html.derivative.ng, source.ts.ng; selector L:text.html -comment | dependency-only; loadable; scope pack unimplemented |
| `angular-template-blocks` | `dist/angular-template-blocks.mjs` | eager angular-expression, angular-template; injectTo text.html.derivative, text.html.derivative.ng, source.ts.ng; selector L:text.html -comment -expression.ng -meta.tag -source.css -source.js | dependency-only; loadable; scope pack unimplemented |
| `cpp-macro` | `dist/cpp-macro.mjs` | eager regexp, glsl | dependency-only; loadable; scope pack unimplemented |
| `es-tag-css` | `dist/es-tag-css.mjs` | eager typescript, css, javascript; injectTo source.ts, source.js; selector L:source.js -comment -string, L:source.js -comment -string, L:source.jsx -comment -string,  L:source.js.jsx -comment -string, L:source.ts -comment -string, L:source.tsx -comment -string, L:source.rescript -comment -string, L:source.vue -comment -string, L:source.svelte -comment -string, L:source.php -comment -string, L:source.rescript -comment -string; inline 1 | dependency-only; loadable; scope pack unimplemented |
| `es-tag-glsl` | `dist/es-tag-glsl.mjs` | eager typescript, glsl, javascript; injectTo source.ts, source.js; selector L:source.js -comment -string, L:source.js -comment -string, L:source.jsx -comment -string,  L:source.js.jsx -comment -string, L:source.ts -comment -string, L:source.tsx -comment -string, L:source.rescript -comment -string; inline 1 | dependency-only; loadable; scope pack unimplemented |
| `es-tag-html` | `dist/es-tag-html.mjs` | eager typescript, html, javascript; injectTo source.ts, source.js; selector L:source.js -comment -string, L:source.js -comment -string, L:source.jsx -comment -string,  L:source.js.jsx -comment -string, L:source.ts -comment -string, L:source.tsx -comment -string, L:source.rescript -comment -string; inline 1 | dependency-only; loadable; scope pack unimplemented |
| `es-tag-sql` | `dist/es-tag-sql.mjs` | eager typescript, sql; injectTo source.ts, source.js; selector L:source -comment -string | dependency-only; loadable; scope pack unimplemented |
| `es-tag-xml` | `dist/es-tag-xml.mjs` | eager xml; injectTo source.ts, source.js; selector L:source.js -comment -string, L:source.js -comment -string, L:source.jsx -comment -string,  L:source.js.jsx -comment -string, L:source.ts -comment -string, L:source.tsx -comment -string, L:source.rescript -comment -string; inline 1 | dependency-only; loadable; scope pack unimplemented |
| `jinja-html` | `dist/jinja-html.mjs` | eager html | dependency-only; loadable; scope pack unimplemented |
| `markdown-nix` | `dist/markdown-nix.mjs` | injectTo text.html.markdown; selector L:text.html.markdown | dependency-only; loadable; scope pack unimplemented |
| `markdown-vue` | `dist/markdown-vue.mjs` | injectTo text.html.markdown; selector L:text.html.markdown | dependency-only; loadable; scope pack unimplemented |
| `vue-directives` | `dist/vue-directives.mjs` | injectTo source.vue, text.html.markdown, text.html.derivative, text.pug; selector L:meta.tag -meta.attribute -meta.ng-binding -entity.name.tag.pug -attribute_value -source.tsx -source.js.jsx, L:meta.element -meta.attribute | dependency-only; loadable; scope pack unimplemented |
| `vue-interpolations` | `dist/vue-interpolations.mjs` | injectTo source.vue, text.html.markdown, text.html.derivative, text.pug; selector L:text.pug -comment -string.comment, L:text.html.derivative -comment.block, L:text.html.markdown -comment.block | dependency-only; loadable; scope pack unimplemented |
| `vue-sfc-style-variable-injection` | `dist/vue-sfc-style-variable-injection.mjs` | eager javascript; injectTo source.vue; selector L:source.css -comment, L:source.postcss -comment, L:source.sass -comment, L:source.stylus -comment | dependency-only; loadable; scope pack unimplemented |

### Complete theme inventory

The host offers **65 bundled VS Code themes** and **2 native palettes**, for **67 selectable themes**. Its VS Code list and `@shikijs/themes@4.4.3` contain the same 65 IDs. Each theme module has a resolved SHA-256 in `assets.json`. Native palettes are source definitions whose containing file is input-hashed in `product-profile.json`.

The bundled list is cited at `editor/packages/editor/src/shiki/vscode-themes.ts:17-183`. Loader definitions are at `packages/client-core/src/themes/registration.ts:12-77`. Snippets and the plugin default to `github-dark`. Registrations supplied through the service have content-revision names; the worker receives copied settings/tokenColors and defined workbench colors. Shiki prefers existing `settings` over `tokenColors`, defaults absent type to dark, and normalizes non-hex colors. The current host loads bundled ESM registrations; arbitrary user JSONC/include import is not implemented by that path. The service API can accept a supplied registration.

| Theme | Label | Mode | Source/version | Status |
| --- | --- | --- | --- | --- |
| `andromeeda` | Andromeeda | dark | `@shikijs/themes@4.4.3/dist/andromeeda.mjs` | selectable; hash resolved; compatibility unverified |
| `aurora-x` | Aurora X | dark | `@shikijs/themes@4.4.3/dist/aurora-x.mjs` | selectable; hash resolved; compatibility unverified |
| `ayu-dark` | Ayu Dark | dark | `@shikijs/themes@4.4.3/dist/ayu-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `ayu-light` | Ayu Light | light | `@shikijs/themes@4.4.3/dist/ayu-light.mjs` | selectable; hash resolved; compatibility unverified |
| `ayu-mirage` | Ayu Mirage | dark | `@shikijs/themes@4.4.3/dist/ayu-mirage.mjs` | selectable; hash resolved; compatibility unverified |
| `catppuccin-frappe` | Catppuccin Frappé | dark | `@shikijs/themes@4.4.3/dist/catppuccin-frappe.mjs` | selectable; hash resolved; compatibility unverified |
| `catppuccin-latte` | Catppuccin Latte | light | `@shikijs/themes@4.4.3/dist/catppuccin-latte.mjs` | selectable; hash resolved; compatibility unverified |
| `catppuccin-macchiato` | Catppuccin Macchiato | dark | `@shikijs/themes@4.4.3/dist/catppuccin-macchiato.mjs` | selectable; hash resolved; compatibility unverified |
| `catppuccin-mocha` | Catppuccin Mocha | dark | `@shikijs/themes@4.4.3/dist/catppuccin-mocha.mjs` | selectable; hash resolved; compatibility unverified |
| `dark-plus` | Dark Plus | dark | `@shikijs/themes@4.4.3/dist/dark-plus.mjs` | selectable; hash resolved; compatibility unverified |
| `dracula` | Dracula Theme | dark | `@shikijs/themes@4.4.3/dist/dracula.mjs` | selectable; hash resolved; compatibility unverified |
| `dracula-soft` | Dracula Theme Soft | dark | `@shikijs/themes@4.4.3/dist/dracula-soft.mjs` | selectable; hash resolved; compatibility unverified |
| `everforest-dark` | Everforest Dark | dark | `@shikijs/themes@4.4.3/dist/everforest-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `everforest-light` | Everforest Light | light | `@shikijs/themes@4.4.3/dist/everforest-light.mjs` | selectable; hash resolved; compatibility unverified |
| `github-dark` | GitHub Dark | dark | `@shikijs/themes@4.4.3/dist/github-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `github-dark-default` | GitHub Dark Default | dark | `@shikijs/themes@4.4.3/dist/github-dark-default.mjs` | selectable; hash resolved; compatibility unverified |
| `github-dark-dimmed` | GitHub Dark Dimmed | dark | `@shikijs/themes@4.4.3/dist/github-dark-dimmed.mjs` | selectable; hash resolved; compatibility unverified |
| `github-dark-high-contrast` | GitHub Dark High Contrast | dark | `@shikijs/themes@4.4.3/dist/github-dark-high-contrast.mjs` | selectable; hash resolved; compatibility unverified |
| `github-light` | GitHub Light | light | `@shikijs/themes@4.4.3/dist/github-light.mjs` | selectable; hash resolved; compatibility unverified |
| `github-light-default` | GitHub Light Default | light | `@shikijs/themes@4.4.3/dist/github-light-default.mjs` | selectable; hash resolved; compatibility unverified |
| `github-light-high-contrast` | GitHub Light High Contrast | light | `@shikijs/themes@4.4.3/dist/github-light-high-contrast.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-dark-hard` | Gruvbox Dark Hard | dark | `@shikijs/themes@4.4.3/dist/gruvbox-dark-hard.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-dark-medium` | Gruvbox Dark Medium | dark | `@shikijs/themes@4.4.3/dist/gruvbox-dark-medium.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-dark-soft` | Gruvbox Dark Soft | dark | `@shikijs/themes@4.4.3/dist/gruvbox-dark-soft.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-light-hard` | Gruvbox Light Hard | light | `@shikijs/themes@4.4.3/dist/gruvbox-light-hard.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-light-medium` | Gruvbox Light Medium | light | `@shikijs/themes@4.4.3/dist/gruvbox-light-medium.mjs` | selectable; hash resolved; compatibility unverified |
| `gruvbox-light-soft` | Gruvbox Light Soft | light | `@shikijs/themes@4.4.3/dist/gruvbox-light-soft.mjs` | selectable; hash resolved; compatibility unverified |
| `horizon` | Horizon | dark | `@shikijs/themes@4.4.3/dist/horizon.mjs` | selectable; hash resolved; compatibility unverified |
| `horizon-bright` | Horizon Bright | light | `@shikijs/themes@4.4.3/dist/horizon-bright.mjs` | selectable; hash resolved; compatibility unverified |
| `houston` | Houston | dark | `@shikijs/themes@4.4.3/dist/houston.mjs` | selectable; hash resolved; compatibility unverified |
| `kanagawa-dragon` | Kanagawa Dragon | dark | `@shikijs/themes@4.4.3/dist/kanagawa-dragon.mjs` | selectable; hash resolved; compatibility unverified |
| `kanagawa-lotus` | Kanagawa Lotus | light | `@shikijs/themes@4.4.3/dist/kanagawa-lotus.mjs` | selectable; hash resolved; compatibility unverified |
| `kanagawa-wave` | Kanagawa Wave | dark | `@shikijs/themes@4.4.3/dist/kanagawa-wave.mjs` | selectable; hash resolved; compatibility unverified |
| `laserwave` | LaserWave | dark | `@shikijs/themes@4.4.3/dist/laserwave.mjs` | selectable; hash resolved; compatibility unverified |
| `light-plus` | Light Plus | light | `@shikijs/themes@4.4.3/dist/light-plus.mjs` | selectable; hash resolved; compatibility unverified |
| `material-theme` | Material Theme | dark | `@shikijs/themes@4.4.3/dist/material-theme.mjs` | selectable; hash resolved; compatibility unverified |
| `material-theme-darker` | Material Theme Darker | dark | `@shikijs/themes@4.4.3/dist/material-theme-darker.mjs` | selectable; hash resolved; compatibility unverified |
| `material-theme-lighter` | Material Theme Lighter | light | `@shikijs/themes@4.4.3/dist/material-theme-lighter.mjs` | selectable; hash resolved; compatibility unverified |
| `material-theme-ocean` | Material Theme Ocean | dark | `@shikijs/themes@4.4.3/dist/material-theme-ocean.mjs` | selectable; hash resolved; compatibility unverified |
| `material-theme-palenight` | Material Theme Palenight | dark | `@shikijs/themes@4.4.3/dist/material-theme-palenight.mjs` | selectable; hash resolved; compatibility unverified |
| `min-dark` | Min Dark | dark | `@shikijs/themes@4.4.3/dist/min-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `min-light` | Min Light | light | `@shikijs/themes@4.4.3/dist/min-light.mjs` | selectable; hash resolved; compatibility unverified |
| `monokai` | Monokai | dark | `@shikijs/themes@4.4.3/dist/monokai.mjs` | selectable; hash resolved; compatibility unverified |
| `night-owl` | Night Owl | dark | `@shikijs/themes@4.4.3/dist/night-owl.mjs` | selectable; hash resolved; compatibility unverified |
| `night-owl-light` | Night Owl Light | light | `@shikijs/themes@4.4.3/dist/night-owl-light.mjs` | selectable; hash resolved; compatibility unverified |
| `nord` | Nord | dark | `@shikijs/themes@4.4.3/dist/nord.mjs` | selectable; hash resolved; compatibility unverified |
| `one-dark-pro` | One Dark Pro | dark | `@shikijs/themes@4.4.3/dist/one-dark-pro.mjs` | selectable; hash resolved; compatibility unverified |
| `one-light` | One Light | light | `@shikijs/themes@4.4.3/dist/one-light.mjs` | selectable; hash resolved; compatibility unverified |
| `plastic` | Plastic | dark | `@shikijs/themes@4.4.3/dist/plastic.mjs` | selectable; hash resolved; compatibility unverified |
| `poimandres` | Poimandres | dark | `@shikijs/themes@4.4.3/dist/poimandres.mjs` | selectable; hash resolved; compatibility unverified |
| `red` | Red | dark | `@shikijs/themes@4.4.3/dist/red.mjs` | selectable; hash resolved; compatibility unverified |
| `rose-pine` | Rosé Pine | dark | `@shikijs/themes@4.4.3/dist/rose-pine.mjs` | selectable; hash resolved; compatibility unverified |
| `rose-pine-dawn` | Rosé Pine Dawn | light | `@shikijs/themes@4.4.3/dist/rose-pine-dawn.mjs` | selectable; hash resolved; compatibility unverified |
| `rose-pine-moon` | Rosé Pine Moon | dark | `@shikijs/themes@4.4.3/dist/rose-pine-moon.mjs` | selectable; hash resolved; compatibility unverified |
| `slack-dark` | Slack Dark | dark | `@shikijs/themes@4.4.3/dist/slack-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `slack-ochin` | Slack Ochin | light | `@shikijs/themes@4.4.3/dist/slack-ochin.mjs` | selectable; hash resolved; compatibility unverified |
| `snazzy-light` | Snazzy Light | light | `@shikijs/themes@4.4.3/dist/snazzy-light.mjs` | selectable; hash resolved; compatibility unverified |
| `solarized-dark` | Solarized Dark | dark | `@shikijs/themes@4.4.3/dist/solarized-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `solarized-light` | Solarized Light | light | `@shikijs/themes@4.4.3/dist/solarized-light.mjs` | selectable; hash resolved; compatibility unverified |
| `synthwave-84` | Synthwave '84 | dark | `@shikijs/themes@4.4.3/dist/synthwave-84.mjs` | selectable; hash resolved; compatibility unverified |
| `tokyo-night` | Tokyo Night | dark | `@shikijs/themes@4.4.3/dist/tokyo-night.mjs` | selectable; hash resolved; compatibility unverified |
| `vesper` | Vesper | dark | `@shikijs/themes@4.4.3/dist/vesper.mjs` | selectable; hash resolved; compatibility unverified |
| `vitesse-black` | Vitesse Black | dark | `@shikijs/themes@4.4.3/dist/vitesse-black.mjs` | selectable; hash resolved; compatibility unverified |
| `vitesse-dark` | Vitesse Dark | dark | `@shikijs/themes@4.4.3/dist/vitesse-dark.mjs` | selectable; hash resolved; compatibility unverified |
| `vitesse-light` | Vitesse Light | light | `@shikijs/themes@4.4.3/dist/vitesse-light.mjs` | selectable; hash resolved; compatibility unverified |
| `tree-sitter-dark` | Native Dark | dark | `apps/web/src/lib/code-theme/utils/catalog.ts:30-32` | selectable; native palette; source input hashed |
| `tree-sitter-light` | Native Light | light | `apps/web/src/lib/code-theme/utils/catalog.ts:62-64` | selectable; native palette; source input hashed |

## Structural parser inventory

The shipped structural catalog has 23 language IDs. Every catalog entry has a resolved parser Wasm hash and hashes for its configured query files. These are available parsers, not implemented native TextMate scope packs. Every scope pack starts as `unimplemented`.

The registry comes from `editor/packages/tree-sitter-languages/languages.json` and `src/catalog.generated.ts:6`. Its parser and query provenance comes from `languages.lock.json`. The JSON manifest cites each language's source row. The loader joins each kind's query files in catalog order and applies capture-name mappings through `src/query-captures.ts:4` and `src/catalog.generated.ts:507`.

Locals queries are absent from every configured language. The catalog explicitly records partial JavaScript, TypeScript, and TSX builtin-shadowing behavior in `languages.json:741`. The declared `regex`, `jsdoc`, and `phpdoc` injection dependencies have no catalog parser. `editor/packages/tree-sitter/src/treeSitter/registry.ts:177` omits dependencies that its resolver cannot load. Their absence is recorded separately from supported injection targets.

Markdown has a separate contract. `editor/packages/tree-sitter/src/treeSitter/markdown.ts:1-16` loads both `tree-sitter-markdown.wasm` and the `tree-sitter-md.wasm` native resolver. The catalog lock records only the grammar Wasm. This inventory records the resolver hash too. Highlights come from `MarkdownDocument.highlights`, as shown in `markdown.ts:25-50`. Fence ranges come from `MarkdownDocument.injections` in `treeSitter.worker.ts:404-456`. Fence aliases resolve against the registered parser catalog. Missing language names remain explicit, and recursive Markdown fences do not create another Markdown layer. The root Markdown document enables frontmatter at `treeSitter.worker.ts:344`.

JavaScript and JSX remain distinct experiment variants. The generated JavaScript catalog loads its JSX highlight query. The low-level `javaScript()` factory defaults `jsx` to false at `tree-sitter-languages/src/index.ts:39-45`; its conditional query composition is at `index.ts:107-125`. Neither variant earns parity from the other's results.

### Structural targets

This matrix records shipped assets and declared capability status. The manifest holds full Wasm and query hashes, repository URLs, lock integrities, and file citations. A parser marked verified has no native TextMate scope-parity claim.

| Language | Structural aliases | Grammar source/version | Revision | ABI | Injection dependencies | Assignment | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `javascript` | js, jsx, node | tree-sitter-javascript 0.25.0 | `44c892e0be055ac465d5eeddae6d3e194424e7de` | 15 | regex, jsdoc | wave-1-distinct-javascript-jsx | partial; scope pack unimplemented |
| `typescript` | ts | tree-sitter-typescript 0.23.2 | `f975a621f4e7f532fe322e13c4f79495e0a7b2e7` | 14 | regex, jsdoc | pilot | partial; scope pack unimplemented |
| `tsx` | typescriptreact | tree-sitter-typescript 0.23.2 | `f975a621f4e7f532fe322e13c4f79495e0a7b2e7` | 14 | regex, jsdoc | pilot | partial; scope pack unimplemented |
| `html` | None | tree-sitter-html 0.23.2 | `5a5ca8551a179998360b4a4ca2c0f366a35acc03` | 14 | javascript, css | wave-1 | partial; scope pack unimplemented |
| `css` | None | tree-sitter-css 0.25.0 | `dda5cfc5722c429eaba1c910ca32c2c0c5bb1a3f` | 15 | None declared | wave-1 | partial; scope pack unimplemented |
| `json` | None | tree-sitter-json 0.24.8 | `ee35a6ebefcef0c5c416c0d1ccec7370cfca5a24` | 14 | None declared | pilot | partial; scope pack unimplemented |
| `markdown` | md, gfm | tree-sitter-md 0.1.1 | `ff455a7dd3dc6177ddaf6879de462cecc34df73f` | 15 | None declared | mixed-pilot-typescript-fences | partial; scope pack unimplemented |
| `astro` | None | https://github.com/virchau13/tree-sitter-astro pinned Git | `213f6e6973d9b456c6e50e86f19f66877e7ef0ee` | 14 | typescript, css | later-wave | partial; scope pack unimplemented |
| `python` | py | tree-sitter-python 0.25.0 | `293fdc02038ee2bf0e2e206711b69c90ac0d413f` | 15 | None declared | wave-1 | partial; scope pack unimplemented |
| `shellscript` | bash, sh, zsh | tree-sitter-bash 0.25.1 | `801326684a26ffc4e749bb016c50c6c30bdfa345` | 15 | None declared | wave-1 | partial; scope pack unimplemented |
| `rust` | rs | tree-sitter-rust 0.24.0 | `18b0515fca567f5a10aee9978c6d2640e878671a` | 14 | None declared | wave-1 | partial; scope pack unimplemented |
| `go` | golang | tree-sitter-go 0.25.0 | `1547678a9da59885853f5f5cc8a99cc203fa2e2c` | 15 | None declared | later-wave | partial; scope pack unimplemented |
| `yaml` | yml | @tree-sitter-grammars/tree-sitter-yaml 0.7.1 | `9632edc32eb86966a482fcb3c9a7f4bb78ae0ddb` | 14 | None declared | later-wave | partial; scope pack unimplemented |
| `toml` | None | @tree-sitter-grammars/tree-sitter-toml 0.7.0 | `64b56832c2cffe41758f28e05c756a3a98d16f41` | 14 | None declared | later-wave | partial; scope pack unimplemented |
| `c` | None | tree-sitter-c 0.24.1 | `7fa1be1b694b6e763686793d97da01f36a0e5c12` | 15 | None declared | later-wave | partial; scope pack unimplemented |
| `cpp` | c++ | tree-sitter-cpp 0.23.4 | `f41e1a044c8a84ea9fa8577fdd2eab92ec96de02` | 14 | None declared | later-wave | partial; scope pack unimplemented |
| `csharp` | c-sharp, cs | tree-sitter-c-sharp 0.23.5 | `cac6d5fb595f5811a076336682d5d595ac1c9e85` | 15 | None declared | later-wave | partial; scope pack unimplemented |
| `java` | None | tree-sitter-java 0.23.5 | `94703d5a6bed02b98e438d7cad1136c01a60ba2c` | 14 | None declared | later-wave | partial; scope pack unimplemented |
| `php` | None | tree-sitter-php 0.24.2 | `5b5627faaa290d89eb3d01b9bf47c3bb9e797dea` | 15 | phpdoc | later-wave | partial; scope pack unimplemented |
| `lua` | None | @tree-sitter-grammars/tree-sitter-lua 0.4.1 | `816840c592ab973500ae9750763c707b447e7fef` | 15 | c | later-wave | partial; scope pack unimplemented |
| `svelte` | None | tree-sitter-svelte 0.11.0 | `be7f2e7db1fc19f0852265ec60923fc058380739` | 14 | typescript, css | later-wave | partial; scope pack unimplemented |
| `sql` | None | https://github.com/DerekStride/tree-sitter-sql pinned Git | `97614d051eebfd3bc5d97c0bdb5a1638719ca811` | 15 | None declared | later-wave | partial; scope pack unimplemented |
| `mdx` | None | https://github.com/srazzak/tree-sitter-mdx pinned Git | `3aa29e8de1bf0213948a04fe953039b6ab73777b` | 15 | markdown | later-wave | partial; scope pack unimplemented |

## Fixture provenance

The manifest pins five source families as ten source sets. It enumerates 1,505 input and expected-result files, plus dependency, grammar-comparison, runner, and license evidence. It records 2,427 unique file hashes; none of these enumerated hashes is unresolved. Selection is deliberately small: 16 source input files, 3 suite JSON files, 11 stored captures/baselines, and 67 dependency files. The 97 unique selected files exclude 1,475 primary artifacts and one dependency. Each product grammar comparison references the module that defines its own recorded scope; the inventory test decodes that payload and reproduces its core hash. Existing upstream expected output is a historical diagnostic profile, not a product golden.

This unit vendors nothing. `fetch-by-hash` means a later preparation step may acquire the exact pinned bytes and preserve their notices. Normal tests and golden generation do not download them. `skip` means no redistribution or oracle use has been authorized by this inventory. File-level records override family-level license summaries.

The TextMate suites inventory 95 cases across 166 input lines. Of these, 94 case candidates are selected. The first-mate SQL grammar attributes builtin lists to O'Reilly; that grammar and its dependent case are skipped. Their bundled grammar files test the oracle's behavior; they do not establish product grammar coverage. Suite 1 has a permissive TextMate notice, and the first-mate suite has its own MIT notice. Their historical generation revisions are unstamped.

TypeScript-TmLanguage uses `vscode-textmate@9.2.1` and `vscode-oniguruma@2.0.1`, separate from the product fork and engine package. Only four manually inspected TypeScript inputs and their four baselines are selected. The maintainer runner also exercises the alternate TSX grammar. MPL-2.0 and externally attributed React samples are skipped. Catalog samples receive the same file-level review. Two TS/JS samples are selected; externally sourced TSX, JSX, JSON, Markdown, Python, and Rust samples remain skipped pending permission evidence.

The VS Code tree-sitter result directory has 18 nonempty and 91 empty outputs. Empty results do not count as compatibility success. Its runner tolerates scope-only differences and rewrites baselines; L2 must keep those behaviors out of the strict comparator.

Five pinned JavaScript annotated-highlight files contain 55 capture assertions. They are position assertions, not complete TextMate scope stacks. The TypeScript and JSON parser revisions have no `test/highlight` suite. Twelve additional upstream fixture-grammar entries remain explicitly uninspected and skipped. Their acquisition tags are not commit pins and create no coverage claim.

The catalog comparison finds 213 matching and 25 differing grammar cores under `patterns`, `repository`, and `scopeName`. Matching these fields does not prove eager/lazy dependency registration equality or historical snapshot provenance. A new product golden must come from the pinned product reference adapter.

### Source and license decisions

Shared VS Code and Tree-sitter reference heads were behind observed remotes. They remained read-only and were not pulled. This inventory pins inspected local revisions, not current upstream heads. Missing grammar acquisition entries are exclusions, not acquired sources.

| Source set | Pinned revision | Path | Family license evidence | Selected/total primary files | Decision |
| --- | --- | --- | --- | --- | --- |
| `vscode-colorize-fixtures` | `5470377e71f72089f2bbd5eb8aeb862892f78b31` | `extensions/vscode-colorize-tests/test/colorize-fixtures` | vscode-mit | 5/109 | fetch-by-hash selected files; skip others |
| `vscode-colorize-results` | `5470377e71f72089f2bbd5eb8aeb862892f78b31` | `extensions/vscode-colorize-tests/test/colorize-results` | vscode-mit | 5/109 | fetch-by-hash selected files; skip others |
| `vscode-colorize-tree-sitter-results` | `5470377e71f72089f2bbd5eb8aeb862892f78b31` | `extensions/vscode-colorize-tests/test/colorize-tree-sitter-results` | vscode-mit | 2/109 | fetch-by-hash selected files; skip others |
| `vscode-textmate-first-mate` | `fbe49961ab8077e587fdf5282019655ae69e5f9e` | `test-cases/first-mate/tests.json` | first-mate-mit | 1/1 | fetch-by-hash selected files; skip others |
| `vscode-textmate-suite1` | `fbe49961ab8077e587fdf5282019655ae69e5f9e` | `test-cases/suite1/tests.json` | suite1-textmate-permissive | 1/1 | fetch-by-hash selected files; skip others |
| `vscode-textmate-while-tests` | `fbe49961ab8077e587fdf5282019655ae69e5f9e` | `test-cases/suite1/whileTests.json` | suite1-textmate-permissive | 1/1 | fetch-by-hash selected files; skip others |
| `typescript-tmlanguage-cases` | `eeeb0dc4daa8793b8227bb3b34ddfc267c85fd81` | `tests/cases` | typescript-mit, typescript-third-party | 4/466 | fetch-by-hash selected files; skip others |
| `typescript-tmlanguage-baselines` | `eeeb0dc4daa8793b8227bb3b34ddfc267c85fd81` | `tests/baselines` | typescript-mit, typescript-third-party | 4/466 | fetch-by-hash selected files; skip others |
| `catalog-samples` | `37edd1b26f18838050661d912334aba0ca7f4931` | `samples` | catalog-mit | 2/238 | fetch-by-hash selected files; skip others |
| `tree-sitter-highlight` | `dcdc8cc55e5dfedfc858080835f153999a29ec40` | `test/fixtures/grammars/<grammar>/test/highlight` | tree-sitter-mit, tree-sitter-javascript-mit, tree-sitter-typescript-mit, tree-sitter-json-mit | 5/5 | fetch-by-hash selected files; skip others |

License IDs resolve to exact notice paths, hashes, and cited lines in `fixture-sources.json`. Directory grants do not clear files with conflicting attribution. The manifest records unstamped historical generation revisions as null and keeps expected-output grammar identity separate from product grammar identity.

## Performance control and measurement protocol

The performance control has the same Fregat commit and package locks as the correctness product profile. It includes Plan 197's landed service and workers. Phase 0 records the measurement protocol only. No benchmark, application build, browser run, or performance tuning was performed in the Platform checkout.

The existing entry point is `bun run bench:large-file`, defined in `package.json:43` as `bun scripts/large-file/bench.ts`. Current flags are in `scripts/large-file/bench.ts:12-31`. The future measurements reuse these commands on a separately owned clean committed checkout:

```sh
bun run bench:large-file --sizes 1,10,50,100,150,200 --ext txt --profile --memory-mib 8192 --out /work/tmp/fregat-evidence/scope-control-plain
bun run bench:large-file --sizes 1,5,10 --ext ts --highlighting shiki,tree-sitter --profile --memory-mib 8192 --out /work/tmp/fregat-evidence/scope-control-ts
bun run bench:large-file --sizes 1,10,50,100,150,200 --ext txt --two-byte --profile --memory-mib 8192 --out /work/tmp/fregat-evidence/scope-control-unicode
```

The current fixture generator is `scripts/large-file/fixture.ts:4-35`. Its TypeScript fixture repeats scoped functions. Its Unicode fixture adds an arrow in the marker and Sigma in variable names. `run.ts:216-245` records exact requested bytes, corpus identity, and selected engine. `bench.ts:67-96` captures source fingerprints before and after building and records reused-build provenance. The benchmark checks active worker identities at `run.ts:126-135` and exact saved hashes at `run.ts:177-193`.

Current metrics include open-to-text, open-to-highlight, save duration, key latency, main-thread heap, backing storage, per-worker heap after GC, and process-tree peak memory. Their recorded result fields are at `run.ts:198-213`; worker sampling is at `workers.ts:11-34`. Profile mode writes `typing.cpuprofile` at `run.ts:152-159` and starts browser tracing at `run.ts:253-263`.

The key metric is still `keydown.timeStamp` to the next `requestAnimationFrame`, with 30 keys at 80 ms intervals by default. `run.ts:33-66` implements it; `bench.ts:21` sets the key count. This frame-quantized measurement cannot establish a 120 Hz typing result. Plan 201, section 0 at `plans/201-cheap-overlay-marks.md:65-81`, owns the replacement metric and plain-text calibration. It specifies input processing plus triggered main-thread frame work, Chromium without frame-rate limiting, and separate language-server and spellcheck attribution. Those switches are absent from the current benchmark flag list. Their measurement remains pending with that owner.

Plan 201's target is p95 below 8.3 ms and no keystroke above 16.7 ms at 10 MiB TypeScript, then larger files within measured memory limits. The target is stated at `plans/201-cheap-overlay-marks.md:45-58`. These are product requirements, not measured results from this unit. Plan 112's historical 10 MiB analysis threshold and mixed-worker memory measurements remain historical controls, as recorded at `plans/112-large-file-ceiling.md:339-349`.

The scope experiment keeps three cost lanes separate, as required by the companion plan's section 10. One measures scope compilation over already available trees. One includes parsing, injections, syntax delivery, and shared rendering. One measures cold initialization and asset loading. Production-like scope work excludes diagnostic explanations on both sides. It preserves the product's ordinary metadata and exact submitted source. Theme changes, repeated edits, huge lines, view disposal, and multiple documents need separate rows. Environment, compiler, warmup, repetitions, fixture hashes, and budgets must accompany each run.

Current engine-selection flags remain `shiki` and `tree-sitter` in the benchmark even though the product service selects backends from theme format. The controlled Shiki row selects `light-plus` and `dark-plus`; the native-palette row selects `tree-sitter-light` and `tree-sitter-dark`, at `run.ts:223-235`. These engine rows are not an all-theme correctness comparison. Phase 5 must refresh the control after Plan 201's common-rendering and Shiki improvements before any cutover claim.

## Phase 6 consumer prerequisites

These are per-consumer contracts. They do not create a dependency on a whole owning plan. The cutover PR must record the current landed commits and relevant acceptance evidence. A status line in this inventory does not replace that proof.

| Consumer | Required existing contract | Owning plan section and current evidence |
| --- | --- | --- |
| Standalone snippet and Settings preview | `HighlightingService.highlight`; exact UTF-16 source, immutable token styles, per-request theme content revision, concurrent themes, cancellation, and operational failure distinction. No retained document is required. | Plan 197, caller-first API and ownership, `plans/197-editor-highlighting-service.md:47-139`; implementation units 1 and 2, `:143-195`; merged service and worker proof, `:265-287`. |
| Rendered Markdown fence | Same service result and broad Shiki language/alias coverage, current imported-theme mode, exact-content cache, streaming supersession, and cold plain-text behavior. | Plan 197, theme and language semantics, `:113-123`; rendered Markdown unit, `:197-205`; stream/theme proof, `:265-279`. |
| Editor document provider | `highlighterProvider()` and `syntaxProvider()` preserve `PackedEditorTokens`, `EditorTokenStore`, snapshot/version checks, incremental patches, structural captures, folding, brackets, selection, and injection ownership. | Plan 197, caller-first API, `:107-111`; service adapters, `:153-155`; provider regression proof, `:210-213`. |
| Prepared diff and live diff view | Service-owned `DiffSyntaxStore`, exact per-side content identity, pending preparation reuse, view interests, bounded eviction, and terminal disposal. No second diff syntax cache. | Plan 197, prepared diff takeover, `:156-172`; disposal proof, `:269-274`; disposed admission proof, `:283-287`. |
| Retained editor analysis | Canonical `EditorTextBufferChange` publication with captured before/after identity and monotonic revision; the relevant ordered source synchronization and backend adapter contract. | Plan 099, canonical publication, `plans/099-document-contributions.md:385-416`; common synchronization and adapters, `:423-493`. Unit 1 proof is delivered at `:3-8`; units 2 through 7 remain authorization-gated at `:25-26`. |
| Retained tab, hover, or multiple views | `EditorDocumentAnalysis` acquisition, range/configuration/result admission, interest-scoped cancellation, shared pending preparation, retention, and paired text/token attachment. Dirty text and undo outlive syntax reclamation. | Plan 198, API and contracts, `plans/198-document-owned-editor-analysis.md:96-218`; current partial delivery and missing pixel/memory/budget proofs, `:3-8`. Current source exports the resource at `editor/packages/editor/src/editor/documentAnalysis.ts:56`. |
| Comparison, historical source, operation preview, or lightweight preview | The landed exact-source and view-attachment contracts, with explicit partial/truncated/binary/unavailable outcomes, source mapping, and retention interests. Preserve operation snapshots and unsaved live-source distinctions. | Plan 200, ownership and contracts, `plans/200-document-backed-content-views.md:87-131`. Implementation is not started at `:3`. Full Plan 200 completion is not a prerequisite for another consumer's backend swap. |
| Language discovery, loading, and prewarming | Existing alias resolution, lazy acquisition, census-based `preloadLanguages`, injection closure, first-result scheduling, dedupe, and failure handling. | Plan 170, phases 2 through 4, `plans/170-language-census.md:250-262` and `:337-363`; Plan 197's takeover, `plans/197-editor-highlighting-service.md:173-176`. Remaining measurement rows do not gate isolated scope work. |

Plan 197's imported-theme statement currently names Shiki/TextMate colors at `:116`. The consumer cutover must reconcile that wording with its owner. Approved scope/style behavior and language coverage remain the contract. This fork makes no early backend switch and adds no dependency to Plan 197, 200, or 201.

## Open questions and handoff

- The product line limit uses `>` while the installed Shiki API uses `>=`. L2 must cover lengths 19,999, 20,000, and 20,001, plus a skipped line inside an open construct. Product skipped-line style uses theme defaults; ordinary Shiki emits an empty foreground.
- Markdown lazy embedding depends on prior grammar registration. L2 must name cold and warmed registry contexts and compare exact-source CRLF offsets explicitly.
- Reference-profile differences require runnable oracles. That Phase 0 item moves to L2, the oracle-adapter unit. L2 must compare raw TextMate, Shiki, and Editor scoped-token conversion before scoring native output.
- Shiki tokenization defaults and wrapper-specific options must remain distinct named profiles when they produce intentional differences. The extractor locks their current identities; L2 owns behavioral conformance fixtures.
- The three missing structural injection dependencies need an explicit scope-pack support decision. The recommendation is to report them as partial coverage until a separately owned parser/pack supplies the expected behavior.
- Markdown's native resolver is a required input to the mixed pilot. The recommendation is to test current MarkdownDocument fence source mapping before assuming that the empty external query list means missing Markdown support.
- Imported user themes have no finite catalog or precomputed hash. Each fixture must lock its normalized input and include closure. No complete future-theme compatibility claim follows from this catalog.
- Plan 201's calibrated per-keystroke metric and attribution switches remain pending. Phase 0 and the oracle lanes proceed without those measurements. Phase 5's release evaluation must use refreshed equivalent-work controls.
