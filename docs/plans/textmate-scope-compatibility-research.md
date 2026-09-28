# TextMate scope compatibility: research dossier

Status: research and planning only. Research date: 2026-09-28.

Companion: [native scope compatibility plan](textmate-scope-compatibility.md).

## 1. Decision this research supports

Investigate a Tree-sitter-only production syntax-highlighting path that emits TextMate-compatible ordered scope stacks and applies VS Code theme rules. Keep Shiki, its TextMate implementation, and upstream VS Code/TextMate in development tooling as reference implementations, not as a proposed second production syntax engine.

The experiment must answer two separate questions:

1. How closely can a native, language-specific scope compiler reproduce the chosen reference's scope assignments across complete files and editing states?
2. How closely does that output reproduce styles under the supported theme contract, at acceptable incremental and memory costs?

This investigation found useful test infrastructure, real regression corpora, and an existing VS Code Tree-sitter implementation to study. It did not run a compatibility benchmark, import a corpus, compile a native prototype, or establish a parity percentage. Earlier conversational percentages and implementation-time guesses are not evidence or commitments.

There is no mathematical requirement to execute TextMate grammars in order to emit their scope vocabulary. There is also no automatic translation from an arbitrary TextMate grammar to an equivalent Tree-sitter query. Source text remains available, but exact compatibility can require extra classification, sub-token analysis, language-specific recovery rules, and maintenance when the reference grammar changes. This is the hypothesis to test, not a promised universal conversion.

## 2. Inspected revisions and reproducibility boundary

| Component | Inspected revision or identity | Role |
| --- | --- | --- |
| `ShaulLavo/tree-sitter-x` | `90dae9cb8e78b074d99d411c6cb3e440d3cd7def` | Target fork; branch base for this documentation |
| Fregat setup configuration | `.github/actions/setup/action.yml`, blob `2e0cd1f2e94c2bf7d6a5bb0ab9c0688d224e2427` | Observed Editor dependency pin |
| `ShaulLavo/singapore` | `560d35db266655e8ba39c5847d5e2ed3d5720fd4` | Editor revision selected by that Fregat configuration |
| `microsoft/vscode` | `f39c7109bf651845855cbef5af2e91b2c9bd0a74` | Colorization harness, capture implementation, TypeScript highlight queries |
| `microsoft/vscode-textmate` | `fbe49961ab8077e587fdf5282019655ae69e5f9e` | Tokenization test runner and reference API |
| `shikijs/shiki` | `ac8e1c438626dbf6f6b4a7fda62276a24c479baf` | Current source-level reference inspection, not an assertion about Fregat's installed Shiki version |

These are research references, not a completed executable dataset lock. Implementation phase 0 must extract the actual consumer lockfile versions, grammar and theme contents, regex engine binary, dependency registrations, and settings. A live documentation page or repository branch is not an acceptable golden-generation input.

The observed Fregat Editor pin changed during the broader discussion. Performance comparisons must use the agreed current incremental Shiki baseline, including the concurrent optimization work, rather than an older implementation chosen because it is easier to beat.

## 3. Ecosystem map: reuse and limits

### 3.1 VS Code's own colorization suite

The pinned VS Code tree contains `extensions/vscode-colorize-tests/src/colorizer.test.ts`. It runs `_workbench.captureSyntaxTokens` and `_workbench.captureTreeSitterSyntaxTokens` over `test/colorize-fixtures`, storing separate results in `colorize-results` and `colorize-tree-sitter-results`. This is particularly relevant prior art: both tokenizers already have a fixture-based testing path. [R1]

The capture implementation records token content, ordered scopes, and theme-color explanations. Its theme passes use default themes, and the shown comparison data is primarily foreground-oriented. It is not a complete all-theme/font-style/semantic-token compatibility suite. [R2]

Do not copy the runner's acceptance behavior unchanged: it rewrites result files on differences and can tolerate scope-only differences when content and theme results remain unchanged. Our strict scope metric must retain those differences, and ordinary CI must never update goldens. Internal capture commands are version-specific test interfaces, not stable extension APIs. [R1]

VS Code's TypeScript highlight query already uses TextMate-style names such as function, parameter, and string scopes, with ordering and text predicates. It also contains explicit limitations and TODOs. Treat it as a baseline candidate to test against our parser version, not proof of exact TextMate equivalence. [R3]

### 3.2 Upstream `vscode-textmate`

This is an interpreter for TextMate grammar files using an Oniguruma-compatible regex interface. `tokenizeLine` returns token boundaries, ordered scopes, and the next line's rule stack. Its own tests load grammar dependencies and optional injection registrations, then pass state through all lines. [R4]

The inspected runner explicitly consumes:

- `test-cases/first-mate/tests.json`
- `test-cases/suite1/tests.json`
- `test-cases/suite1/whileTests.json`

These are strong reference-adapter and state-handling tests. Some cases use artificial grammars with no corresponding Tree-sitter language. Those belong in the oracle-conformance lane, not a misleading native-language parity denominator. [R4]

### 3.3 `vscode-tmgrammar-test` and `vscode-tmgrammar-snap`

These are two commands provided by the same project, not two independent reference engines. The project supports annotated scope assertions, ordered positive/negative expectations, and snapshot generation. Its `package.json`-style configuration can describe grammars and `injectTo` registrations. [R5]

Reuse its fixture ecosystem through a deliberate adapter. Its annotation preprocessing, negative assertion syntax, and selected-position assertions are not identical to Tree-sitter's format. A passing assertion file does not establish equality over unasserted text. Preserve source maps when preprocessing annotations, and supplement assertions with complete interval comparisons. [R5, R10]

### 3.4 Shiki and its grammar/theme supply chain

Shiki is the product-facing reference for the bundle Fregat actually uses. Its source exports `@shikijs/vscode-textmate`; it is not sufficient to assume that the latest upstream `vscode-textmate` package is exactly the same implementation. These references share lineage and are not three independent votes on correctness. [R6]

Shiki's inspected token path can execute both scoped and encoded tokenization when explanations are enabled. It also has empty-line handling and length/time-limit policies. Scope explanations and rich object output are useful diagnostics, but should not be silently included in only one side of a performance comparison. Raw TextMate, Shiki, and the current Editor wrapper can differ before the native candidate is involved. [R7]

`shikijs/textmate-grammars-themes` provides normalized grammar/theme assets, upstream source metadata, notices, and language samples. This is a useful breadth census and smoke corpus, not an exhaustive grammar regression suite. Its assets are updated independently; freeze the actual shipped artifacts instead of following the latest catalog during CI. [R8]

Shiki supports different regex engines. The reference lane must explicitly select and pin the production-relevant engine. An optional alternative-engine comparison is diagnostic, never a silent replacement for the oracle. [R9]

### 3.5 Language-maintainer regressions

`microsoft/TypeScript-TmLanguage` contains its own tests and generated baselines, with explicit test/diff/accept commands. Use its TypeScript/TSX cases alongside VS Code's fixtures for the first compatibility pack. Match the grammar revision before interpreting existing expected output; regenerate a separately named baseline when the target artifact differs. [R11]

For later languages, phase 0 must record each selected grammar's upstream fixture directory, format, license, pinned revision, and which cases can be reused. Do not invent coverage by counting a parser's grammar corpus as if it were already a scope golden suite.

### 3.6 Tree-sitter's existing highlighter ecosystem

Tree-sitter has highlight, local-variable, and injection queries, plus annotated `test/highlight` fixtures. Those tests establish the behavior of their capture system; they are not TextMate scope-stack goldens. Local-variable classifications can also deliberately differ from a lexical TextMate reference. [R10]

The fork includes the existing `tree-sitter-highlight` crate. Its documented convenience API takes source bytes and produces highlight events with an injection callback. Before reusing it, audit whether the selected integration can consume the editor's existing trees and preserve their lifetimes. Do not accidentally introduce a second Tree-sitter parse merely to avoid a TextMate parse. [R15]

### 3.7 Native TextMate/Sublime alternatives

Syntect is relevant engineering prior art for compact scopes, parser-independent highlighting components, and editor-oriented state caching. Its stated syntax compatibility target is Sublime Text, so it is not a drop-in proof of VS Code/TextMate parity. A native TextMate interpreter remains an alternative architecture, not the selected direction of this plan. [R16]

Oniguruma is a regex implementation, not a scope synthesizer or theme engine. The selected production experiment does not add it. Whether a bounded regex facility is needed for Tree-sitter query predicates is a separate implementation decision and must not quietly become a TextMate grammar interpreter. [R9, R12]

## 4. Native seams confirmed in this fork

`lib/binding_web/src/extension.ts` loads native extensions built for the existing dynamic-module arrangement. They share parser memory and can access Tree-sitter's C API; `heap()` exposes a view which must be reacquired after memory growth. This supports a native scope pass without JavaScript node traversal. It does not automatically provide cross-worker shared memory, stable pointers across reallocations, cancellation, or a versioned highlighter ABI. [R13]

`TextBuffer` stores UTF-16 code units in parser memory. It is mutable; trees reading its text observe subsequent edits. Its current edit implementation shifts the remaining suffix in a contiguous buffer. A shared-memory design can eliminate some boundary copies without making every text edit constant-time. Coordinate conversions and buffer/tree/revision lifetimes must be explicit. [R14]

Tree-sitter's C query engine exposes predicates and directives; it does not evaluate them on behalf of native extensions. A direct C highlighter therefore needs its own supported predicate/directive contract. Importing queries from the CLI, VS Code, or another editor without that layer can produce plausible but incorrect results. [R12]

The inspected Singapore scoped tokenizer already separates scopes from theme styles and updates cached styles on theme changes. Preserve this behavior. A new native implementation must be compared against the current consumer implementation, not against an invented full-retokenization baseline. [R17]

## 5. Compatibility distinctions that change the experiment

**Theme-format support is not scope equivalence.** A theme matcher may load a theme correctly while the producer emits different scopes. Measure theme normalization, matching, scope synthesis, and final output independently.

**Passing a finite theme collection does not establish all-theme equivalence.** A scope difference can be invisible under today's themes and visible under a selector that specifically targets the differing scope or ancestor. Add adversarial selector themes and report exact ordered scope parity separately. Conversely, different token segmentation with identical assignments at every position is not a visual failure.

**TextMate scope paths are not syntax-tree ancestry.** Captures, punctuation ranges, wrapper scopes, whitespace, and embedded language transitions can require intervals that do not coincide with named AST nodes. Structural context is an input to scope synthesis, not its output format.

**The selector dialect must be versioned.** TextMate documents scope prefixes, ordered contextual matching, grouping, exclusions, and ranking. Do not assume that every construct in the TextMate manual is accepted with identical precedence by the pinned VS Code or Shiki theme path. Test the actual target implementation and reject or diagnose unsupported constructs consistently. [R18]

**Syntax parity is not semantic parity.** VS Code can apply semantic tokens over grammar highlighting. This plan measures syntax-only reference behavior. Semantic tokens, workbench chrome, icon themes, and arbitrary extension execution are separate contracts. [R19]

**One engine does not mean one tree.** Embedded languages may require additional Tree-sitter trees. The goal is one syntax technology and shared document ownership, not a claim that every mixed-language document fits into one parser tree.

## 6. Unresolved questions and required evidence

| Question | How to resolve it |
| --- | --- |
| Which exact Shiki behavior is the product target? | Extract Fregat/Singapore dependency lock and wrapper settings; compare raw TextMate, Shiki, and consumer output before grading the candidate. |
| How much context must scope packs reconstruct? | Pilot TS/TSX on real regressions; classify differences by leaf, ancestor, order, interval, injection, and recovery behavior. |
| Can native predicate support remain small? | Inventory predicates in chosen query packs; implement a documented subset and fail closed on others. |
| What breaks when syntax is incomplete? | Prefix/typing fixtures and deterministic edit sequences; compare fresh and incremental native results after every step. |
| How local is invalidation in practice? | Measure dependency-region expansion, not just Tree-sitter parse ranges. Start conservatively and validate each optimization. |
| What is the actual coverage ceiling? | Publish a pinned catalog with unsupported entries and reasons; expand beyond favorable pilot languages. |
| Is the memory goal achieved? | Separate text, trees, scope storage, style caches, transport, JavaScript retention, and Wasm capacity in comparable runs. |
| Which assets can be redistributed? | Inspect per-asset notices and provenance before copying; use fetch-by-hash manifests where appropriate. |

No answer in this table is supplied by the fact that code is compiled to Wasm. The companion plan makes each uncertainty a work item and an explicit gate.

## Sources

Links to inspected code use fixed commits when available. Live documentation was read on 2026-09-28 and must not serve as a future executable lock.

- R1: [VS Code colorization test runner](https://github.com/microsoft/vscode/blob/f39c7109bf651845855cbef5af2e91b2c9bd0a74/extensions/vscode-colorize-tests/src/colorizer.test.ts).
- R2: [VS Code token capture and theme explanation implementation](https://github.com/microsoft/vscode/blob/f39c7109bf651845855cbef5af2e91b2c9bd0a74/src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts).
- R3: [VS Code TypeScript Tree-sitter highlight queries](https://github.com/microsoft/vscode/blob/f39c7109bf651845855cbef5af2e91b2c9bd0a74/src/vs/editor/common/languages/highlights/typescript.scm).
- R4: [vscode-textmate tokenization test runner](https://github.com/microsoft/vscode-textmate/blob/fbe49961ab8077e587fdf5282019655ae69e5f9e/src/tests/tokenization.test.ts) and [API](https://github.com/microsoft/vscode-textmate/blob/fbe49961ab8077e587fdf5282019655ae69e5f9e/src/main.ts).
- R5: [vscode-tmgrammar-test and snapshot command documentation](https://github.com/PanAeon/vscode-tmgrammar-test).
- R6: [Shiki TextMate re-export](https://github.com/shikijs/shiki/blob/ac8e1c438626dbf6f6b4a7fda62276a24c479baf/packages/core/src/textmate.ts).
- R7: [Shiki scoped and encoded tokenization path](https://github.com/shikijs/shiki/blob/ac8e1c438626dbf6f6b4a7fda62276a24c479baf/packages/primitive/src/highlight/code-to-tokens-base.ts) and [grammar-state documentation](https://shiki.style/guide/grammar-state).
- R8: [TextMate grammar/theme catalog, samples, source metadata, and notices](https://github.com/shikijs/textmate-grammars-themes).
- R9: [Shiki regex engine documentation](https://shiki.style/guide/regex-engines).
- R10: [Tree-sitter highlighting, locals, injections, and unit tests](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html).
- R11: [TypeScript-TmLanguage tests and baseline workflow](https://github.com/microsoft/TypeScript-TmLanguage).
- R12: [Tree-sitter predicates and directives, including the C-library boundary](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/3-predicates-and-directives.html).
- R13: [Fork extension loader and heap access](https://github.com/ShaulLavo/tree-sitter-x/blob/90dae9cb8e78b074d99d411c6cb3e440d3cd7def/lib/binding_web/src/extension.ts).
- R14: [Fork TextBuffer implementation](https://github.com/ShaulLavo/tree-sitter-x/blob/90dae9cb8e78b074d99d411c6cb3e440d3cd7def/lib/binding_web/src/text_buffer.ts).
- R15: [Existing tree-sitter-highlight API examples](https://github.com/ShaulLavo/tree-sitter-x/blob/90dae9cb8e78b074d99d411c6cb3e440d3cd7def/crates/highlight/README.md).
- R16: [Syntect scope/storage/editor integration prior art](https://github.com/trishume/syntect).
- R17: [Singapore scoped tokenizer at the observed consumer pin](https://github.com/ShaulLavo/singapore/blob/560d35db266655e8ba39c5847d5e2ed3d5720fd4/packages/editor/src/shiki/scopedTokens.ts).
- R18: [TextMate scope selector manual](https://macromates.com/manual/en/scope_selectors).
- R19: [VS Code semantic highlighting contract](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide) and [syntax highlighting contract](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide).
- R20: [Fork contribution and test instructions](https://github.com/ShaulLavo/tree-sitter-x/blob/90dae9cb8e78b074d99d411c6cb3e440d3cd7def/docs/src/6-contributing.md).

This documentation was researched and drafted with an AI assistant at the fork owner's request. It is a proposal for review in the owner's fork, not an upstream submission or a claim of human review or implemented functionality.
