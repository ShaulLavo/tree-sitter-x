# Plan: native Tree-sitter scopes with VS Code theme compatibility

Status: **Approved.** Phases 0 and 1 complete 2026-10-01; Phase 2 not started.

Date: 2026-09-28. Target: `ShaulLavo/tree-sitter-x`, based on `90dae9cb8e78b074d99d411c6cb3e440d3cd7def`.

Evidence, inspected revisions, and source links: [research dossier](textmate-scope-compatibility-research.md). References such as R1 below refer to that dossier's source list.

## 1. Outcome and boundaries

Build and evaluate an optional native scope compiler that consumes the editor's existing Tree-sitter trees and source text, emits ordered TextMate-compatible scope intervals, and resolves VS Code syntax theme rules without Shiki or a TextMate tokenizer in the selected production path.

The initial deliverable is a reproducible compatibility experiment, not immediate replacement of Fregat's existing highlighter. The final architecture should use one syntax-engine family. Embedded languages may still require multiple Tree-sitter trees.

### Required outcomes

- A version-locked differential suite comparing raw TextMate scopes, Shiki product output, the existing Editor wrapper where relevant, and native output.
- Per-language and per-theme evidence, including incomplete source and edit sequences. Unsupported languages, failed references, and timeouts remain visible.
- Native classification over shared source/tree state, with compact scope IDs and no per-token JavaScript objects on the normal production path.
- Theme changes independent of parsing and scope synthesis.
- Correct incremental output equivalent to fresh native computation after every tested edit.
- A scoped rollout decision backed by coverage, correctness, memory, and latency results.

### Explicit non-goals

This plan does not implement a native TextMate interpreter, compile arbitrary `.tmLanguage` files into Tree-sitter parsers, execute arbitrary VS Code extensions, reproduce semantic/LSP classifications, or replace workbench/icon themes. It does not change Fregat, Singapore, grammar forks, release packages, dependencies, CI, or runtime code in this PR.

Shiki, `vscode-textmate`, and Oniguruma may be **development-only oracle dependencies**. No automatic production fallback to them is added by this work. Existing application behavior stays unchanged until a separately reviewed integration is ready. An unsupported experimental case is reported explicitly, not disguised as compatibility.

The 2 GB memory report motivates measurement but has not been reproduced by this research. No percentage, completion date, or speedup is promised.

## 2. Define what compatibility means before building

Treat these as separate contracts:

| Contract | Meaning | Acceptance evidence |
| --- | --- | --- |
| Theme input | The supported JSON/JSONC theme form is normalized with defined defaults and include resolution. | Loader and normalization fixtures; unsupported inputs diagnosed. |
| Scope compatibility | The chosen language pack reproduces ordered scope assignments over source positions. | Exact scope interval comparisons, including ancestor scopes and punctuation. |
| Visual compatibility | Resolved syntax styles match under the chosen normalized themes. | Independent style comparison over aligned intervals. |
| Editor metadata | Required embedded-language and standard-token-type information is preserved. | Separate metadata tests; do not treat raw scope strings as a substitute. |
| Incremental correctness | An edit sequence produces the same native result as a fresh computation of each resulting document. | Deterministic replay and generated edit tests. |
| Coverage | The target grammar/theme catalog is accounted for. | Versioned supported/partial/unsupported inventory with reasons. |

A finite set of matching theme colors is not proof of compatibility with every possible future theme. A custom rule can distinguish differing scope paths. Conversely, splitting an unchanged style into two tokens is not a visual mismatch. Never report raw token-count equality as the main success metric.

### Reference profiles

Define named profiles rather than an ambiguous "VS Code/Shiki" oracle:

1. **Product profile:** exact grammar assets, themes, regex engine, aliases, registrations, and options used by the agreed Fregat/Singapore baseline. This drives the initial replacement decision.
2. **Raw scope profile:** an explicitly pinned TextMate implementation with an explicit registry configuration and line-state contract. This measures scope fidelity and reference-adapter behavior.
3. **VS Code integration profile:** a pinned VS Code build, built-in grammar assets, extensions/settings manifest, and syntax-only captures. This detects editor integration differences rather than overruling the product profile silently.

Run the reference implementations against equivalent inputs before scoring the native candidate. Diagnose differences caused by asset versions, injections, blank-line handling, theme normalization, token coalescing, engine choices, and budgets. Shiki's TextMate fork and upstream TextMate share lineage; agreement is useful, not independent majority voting. [R4, R6, R7]

Where a reference difference remains intentional, record a named profile expectation with a minimal fixture. Do not modify a golden or discard an input merely to make the native score improve.

### Cross-project dependencies and execution order

[Fregat's execution roadmap](https://github.com/ShaulLavo/fregat/blob/main/PLAN.md) remains the scheduler; this fork owns the scope compiler and its compatibility evidence, not a replacement cross-project queue. The dependency review used Fregat `43d14690319abb1499e8b556d0bda19194486ed7` and its [roadmap](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/PLAN.md). Links below identify that inspected snapshot. Recheck each owning plan and implementation before its dependent cutover; historical statuses are not fresh completion evidence.

**The experiment can proceed independently. Production integration is contract-gated.** Phases 0–5 do not wait for the entire wave-2 queue, Plan 197, full Plan 099, or full Plan 198 acceptance. Isolated native edit/lifetime tests may run in the harness before consumer contracts are ready. Phase 6 must use the relevant landed owners rather than inventing replacement application plumbing.

| Owner / plan | Relationship to this work | Ordering rule |
| --- | --- | --- |
| [197: highlighting service](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/197-editor-highlighting-service.md) | Owns provider/service lifetime, language/theme loading, standalone highlighting and prepared-diff syntax. This plan supplies a backend, not another service or cache. | Establish the service boundary needed by each production consumer migration first. 197 ships with existing backends and must not wait for native parity. Its standalone path does not require 198's retained-document lifetime. |
| [099: document contributions](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/099-document-contributions.md) | Unit 1 owns canonical revision-tagged publication; common consumer synchronization stays with its existing owner. The inspected unit 1 remains open. | Retained-document integration consumes the relevant publication and synchronization contracts. Do not require all of 099 or its unrelated minimap/LSP migrations. Units 2–7 retain their authorization gate; a dependent adapter waits for its needed contract, rather than creating a parallel journal. |
| [198: document-owned analysis](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/198-document-owned-editor-analysis.md) | Retained analysis code has partly landed; acquisition, result admission, cancellation, retention and attachment still need their stated acceptance proof. | Reuse and prove the specific guarantees required by retained editor/view integration. Do not recreate an analysis owner or require completion of unrelated work. Standalone snippets and fork-level experiments do not wait on retained-view acceptance. |
| [200: content views](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/200-document-backed-content-views.md) | Owns comparison/preview content acquisition and view attachment. Its prerequisites are the relevant 099/198 contracts and 197's diff service. | Neither plan is a blanket prerequisite for the other. 200 proceeds using current backends. A later native backend swap preserves its landed source/attachment contracts; it does not repeat its migration or own another diff cache. |
| [201: large-file typing](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/201-cheap-overlay-marks.md) | Owns typing-cost attribution, overlay fixes, language-service policy and the large-file highlighter decision in step 4. | Overlay and measurement work proceed without native parity. Coordinate evidence for step 4; this plan is not an assumed fix for overlay or LSP cost. Refresh the end-to-end baseline against current Shiki improvements before cutover. |
| [176: Markdown parser](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/176-markdown-parser.md) / [189: later improvements](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/189-tree-sitter-md-improvement.md) | 176 records the released shared-runtime parser and Editor integration; 189 owns subsequent parser improvements. Some older release-blocker text is superseded by 176's implementation evidence. | Reuse the current MarkdownDocument/extension owner and coordinate shared runtime files. Markdown/injection acceptance requires the relevant parser behavior, not every future 189 pass. TS/TSX/JSON work proceeds independently. Do not repeat the shipped parser migration. |
| [112: file ceiling](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/112-large-file-ceiling.md) / Editor E015–E016 | 112 is recorded complete; E015 owns massive-file loading and E016 bounded structural parsing in that lane. | Reuse the existing ceiling benchmark. Full-source scope compilation does not wait for paging or bounded parsing. Any partial-tree mode must first establish an explicit context/coverage contract with those owners; it cannot be introduced as a scope optimization that silently loses context. |
| [170: language census](https://github.com/ShaulLavo/fregat/blob/43d14690319abb1499e8b556d0bda19194486ed7/plans/170-language-census.md) | Main census/warm-up phases are implemented; some measurement rows remain. 197 owns the service-side takeover. | Preserve existing alias resolution, lazy loading and prewarming during integration. Remaining census measurements do not block the harness or native pilot. |

The resulting order has parallel lanes: the fork's harness and native compatibility work; 197's service work; the relevant 099/198 document contracts; and 201's independent performance work. They meet at the affected production cutovers. No new dependency from 197, 200, 201, or unrelated wave work to this experiment is introduced. Plans 171/182 keep composer/search ownership; this backend does not absorb those migrations.

**Resolve the Plan 197 wording at cutover.** Its inspected semantics say imported VS Code themes retain Shiki/TextMate colors. Treat Shiki as the initial implementation, while preserving observable scope/style behavior and language coverage. Before selecting the native backend in production, reconcile that wording with 197's owner in the consumer PR so backend identity is not accidentally made a permanent public contract. This fork PR does not edit 197 or authorize an early engine switch.

**Do not revive the rejected transport work.** 099 records Editor E057's completed SAB text-transport removal and keeps separate workers. Sharing the parser's Wasm heap with a native extension inside the same runtime is not cross-worker shared text. The existing Editor buffer remains authoritative; parser-local storage is its synchronized analysis representation. No worker consolidation, replacement document storage, shared allocator project, or revival of E010/E012/E013 is a prerequisite. A broader transport change requires a separate measured decision.

**Keep the roadmap link explicit without expanding this PR.** Record this fork plan as an external backend experiment in the next authorized Fregat roadmap/index reconciliation, with only the cutover dependencies above. That bookkeeping is not an execution prerequisite and must not reorder the owner's remaining queue. This PR changes no Fregat/Singapore files.

## 3. Proposed implementation boundaries

Keep parser core, scope packs, theme resolution, and editor adapters separate. Prefer an optional component so upstream parser users do not inherit theme catalogs or TextMate tooling.

| Component | Responsibility |
| --- | --- |
| Existing parser/document owner | Own source, root/injected trees, revision, edit ordering, and disposal. |
| Native scope compiler | Query/walk supplied trees, evaluate supported predicates, compose scope intervals, maintain incremental scope state. |
| Versioned language scope pack | Map a specific Tree-sitter grammar to a specified TextMate grammar's scope behavior. |
| Theme normalizer/resolver | Normalize theme input outside the hot loop; resolve interned scopes to style IDs. |
| Host/editor adapter | Expose revision-tagged packed results, schedule work, and preserve renderer/provider contracts. |
| Development harness | Load references, generate immutable goldens, replay edits, compare outputs, and report coverage/performance. |

Suggested future locations, subject to review before implementation:

- `test/highlight-compat/`: manifests, oracle adapters, fixture adapters, golden schemas, comparison logic, replay tests, and reports.
- `lib/scope-compat/`: optional native core and C ABI, or an equivalently isolated crate if the language decision favors Rust.
- `lib/binding_web/`: minimal loading/typed wrapper integration, not a second document owner.
- A dedicated scope-pack directory/package: versioned data and queries, separate from generic parser ABI.

These paths are proposals; this PR creates only the two planning Markdown files.

### Language choice

The existing C-extension loader makes a portable C core a reasonable first spike. Keep the host boundary as a small C ABI regardless of implementation language. Select C, Rust, or Zig only after checking shared-module linking, allocation ownership, native builds, Wasm support, and maintainability. Do not choose a language on an unsupported assumption that Wasm is faster.

The existing `tree-sitter-highlight` crate is prior art and a possible source of reusable logic. Audit its integration before reuse: the documented convenience interface accepts source bytes. The prototype must demonstrate that highlighting uses the document owner's trees rather than initiating a redundant parse. [R13, R15]

## 4. Language scope packs, not a global rename table

A pack describes:

- Language ID, aliases, root scope, parser/ABI/query identities, reference TextMate grammar hash, and injection dependencies.
- Structural rules for leaf classifications and enclosing scope regions.
- Stable rule IDs, ordering/priority, text predicates, sub-token extraction, and recovery behavior.
- Dependency domains needed for safe invalidation.
- Known deviations, supported capabilities, and test fixture IDs.

Do not equate an AST ancestor path with a TextMate scope stack. The compiler must support enclosing scopes that cover whitespace or punctuation, content regions that exclude delimiters, multiple ordered scopes on a single span, and scopes narrower than a named node.

### Scope composition

Specify composition before optimizing it:

1. Queries and bounded native classification routines produce annotated intervals.
2. Resolve competing classifications using explicit pack priority and stable tie-break rules. Never rely on incidental query enumeration order.
3. Compose active intervals into an ordered scope path for each resulting segment.
4. Split at relevant boundaries; coalesce adjacent segments only when the complete semantic payload matches.
5. Intern paths and emit compact records.

Partially overlapping intervals cannot always be represented by naively pushing and popping AST ancestors. Use a deterministic interval-composition algorithm with well-defined precedence. Coincident intervals, duplicate captures, wrapper/leaf order, and injection boundaries need fixtures.

Start with two diagnostic baselines: ordinary highlight captures plus a simple mapping, and VS Code's relevant Tree-sitter query where it compiles against the pinned parser. Compare the richer scope pack against both. VS Code's TypeScript query is useful prior art, not an established parity baseline for this fork. [R3]

### Predicates and sub-token classification

The C query engine does not execute predicates or directives. Inventory every predicate used by accepted packs and implement an explicit native contract: equality, quantified equality, membership, supported text matching, and used directives. Unknown operations must fail pack loading, never silently match everything. [R12]

A constrained regex or scanner used on a captured token does not require a second whole-document TextMate tokenizer. Define supported syntax and limits, test Unicode behavior, and choose a bounded implementation. Do not reinterpret JavaScript, Rust, and Oniguruma regex dialects as interchangeable.

Escapes, regex internals, comment tags, heredoc markers, and interpolation may require dedicated Tree-sitter injection grammars or bounded pack-level text scans. Record which mechanism each pack uses and include its cost in benchmarks. Avoid recreating an unrestricted TextMate interpreter under a different name.

### Error recovery

`ERROR` and `MISSING` nodes, half-written strings, incomplete types, and unfinished templates are normal editor inputs. Initially use conservative full-region recomputation. A compatibility deviation may be accepted only through an explicit case/pack decision; "Tree-sitter is more correct" is not a reason to erase a mismatch from the strict report.

Do not add project-wide semantic classifications to improve this syntax-only score. Local classification is allowed when a pack needs it, but must reproduce the selected lexical reference rather than silently changing the target.

## 5. Native ABI, coordinates, and ownership

The first ABI is experimental and versioned. Prefer document/session handles and explicit revision checks over publicly exposing raw `tree[0]` conventions as a permanent API.

A proposed request carries a borrowed tree handle, a source view with encoding and length, document revision, pack identity, requested ranges, and a work budget. A response carries its revision, completeness/status, packed span buffer, scope-table identity, and ownership/release information. Theme resolution may be requested separately using a theme revision.

### Coordinate contract

- Public editor ranges use half-open UTF-16 code-unit offsets into the exact submitted source snapshot.
- C Tree-sitter byte offsets and `TSPoint` columns must be converted according to the input encoding. A UTF-16 code-unit index is not a byte offset.
- Native UTF-8 callers require an explicit adapter/index; never reinterpret offsets.
- Preserve LF, CRLF, lone CR where supported, BOMs, tabs, trailing newline, empty input, astral characters, combining characters, and the editor's policy for lone surrogates or split-surrogate edits.
- Goldens preserve original content and line terminators. Parser recovery or renderer normalization must not silently rewrite the comparison source.

The fork's current `TextBuffer` uses UTF-16 and is mutable. A borrowed tree and its text must be read under a single consistent revision. Prevent concurrent mutation while a native pass uses borrowed pointers; stale work cannot publish. [R14]

### Storage and lifecycle

Use records conceptually equivalent to `start`, `end`, and `scopeStackId`, plus separate metadata when needed. These are proposed logical fields, not a frozen wire layout. Intern `(parentScopeId, scopeNameId)` paths, share style resolution by `(themeRevision, scopeStackId)`, and avoid retaining token content strings.

Use block-relative positions or an indexed interval structure so insertion at the beginning does not require rewriting every absolute token offset. Scope IDs need a documented generation/lifetime; they are not globally comparable across processes or sessions.

Explicitly specify who allocates and frees each buffer, whether spans are borrowed or owned, when memory growth invalidates host views, and what disposal does to in-flight requests. Bound or reclaim unused interned scopes and style caches. Multiple views should share document syntax state without one view disposing another's owner.

Shared Wasm linear memory inside one runtime is not automatically cross-worker shared memory. Keep the initial extension in the parser's worker/runtime. Any future cross-worker design needs separate synchronization and platform analysis. Native modules sharing a heap are trusted code, not a sandbox boundary for arbitrary third-party extensions. [R13]

Guard allocation overflow, recursion depth, injection depth, match count, output volume, invalid ranges, use-after-dispose, and cancellation. A limited or canceled result is explicitly incomplete and cannot overwrite a complete result for another revision.

## 6. Incremental invalidation

Tree-sitter changed ranges are not a complete highlighting invalidation policy. A text-only identifier edit can change a predicate without changing broad tree shape; a rule can depend on an ancestor, sibling, declaration, or injection selector outside the edited range.

Start correct and conservative:

1. Apply edits in the document owner's defined coordinate order, recording both old and new changed text spans.
2. Update/reparse the existing trees with those edits.
3. Combine direct text edits with structural changes and invalidated injection descriptors.
4. Expand to each affected rule's declared dependency region, including necessary ancestors and related local/injection state.
5. Recompute those regions and compose with valid surrounding scopes.
6. Publish a revision-tagged patch with explicit old/new coordinate semantics.

If a rule's dependency domain cannot be established, invalidate the enclosing document. Do not hide a correctness bug behind a guessed fixed lookbehind window.

Every optimization must preserve:

`native_incremental(source_after_edits) == native_fresh(source_after_edits)`

Compare decoded scope paths and metadata, not process-local IDs or internal tree identities. Separately compare that fresh result to the selected reference. This distinguishes an incremental bug from a classification mismatch.

Required edit tests include same-shape renames that change builtin/constant predicates, delimiter insertion/deletion, edits on blank lines, CRLF changes, multi-cursor batches, undo/redo, injection-language changes, and edits before cached regions. State changes may legitimately affect the rest of a document; the API must support bounded scheduling rather than promise constant-time updates.

Viewport queries must include enough enclosing context to produce the same answer as a full-document pass. A clipped fragment must not be treated as a new root language or as evidence that all earlier scopes are irrelevant.

## 7. Embedded-language contract

Use one explicit injection registry shared with the document owner where practical. A descriptor includes parent language/scope context, injected pack identity, source ranges, coordinate mapping, and revision.

Test HTML with JavaScript/CSS, Markdown fences, TSX/JSX transitions, template interpolation, regex literals, and selected tagged templates or heredocs. Only expect a particular injection when the pinned TextMate registration actually enables it.

Multiple disjoint content ranges, excluded child nodes, and combined injections require explicit source mapping. Injected positions must map back to the original document without being shifted by virtual concatenation or hidden delimiters. Parent scope paths may remain relevant to theme matching.

A changed fence/tag/delimiter can invalidate the child parser, scope pack, and downstream context. Unknown injected languages must produce a declared unsupported/plain result or a documented outer-language result; neither counts as successful parity for the missing language.

## 8. Theme implementation and independent validation

During the classification experiment, apply the pinned reference theme matcher to native scopes in the **test harness**. This isolates scope synthesis from errors in a new native theme matcher. Also verify that feeding reference scopes to that harness reproduces direct reference styles.

Then implement or adapt the native resolver against those tests. It must not become correct merely because both the candidate and its golden generator share the same incorrect new matcher.

The loader/resolver contract covers:

- Theme defaults, `tokenColors`, normalized settings, supported includes, and content-based revision identity.
- Scope prefixes, contextual parent matching, specificity, tie-breaking, multiple selectors, and inherited properties according to the pinned target.
- Unset versus explicitly cleared `fontStyle`, plus bold, italic, underline, and strikethrough where supported.
- Foreground and relevant background behavior; compare every style field the chosen profile actually applies.
- Unsupported selector syntax and unsupported theme properties, with explicit diagnostics rather than guessed semantics.
- Concurrent themes and theme changes without stale cache reuse.

Do not compare raw packed metadata integers between different implementations. Decode named fields using the pinned implementation's helpers, and document profile-specific fields. Likewise, a missing style property is not automatically equivalent to an explicit reset.

`semanticTokenColors` and workbench colors may be preserved by a host theme loader, but they are outside this syntax matcher score. Document that boundary instead of advertising complete VS Code rendering parity. [R18, R19]

## 9. Differential suite design

### 9.1 Asset lock and provenance

The manifest records exact package versions and integrity hashes; repository commits; grammar files and dependency closure; theme files and include closure; regex engine and Wasm hash; Tree-sitter parser ABI/binary/query hashes; pack revision; oracle settings; corpus versions; seeds; runtime/platform identifiers; and license/attribution paths.

Resolve aliases deterministically. Missing grammars or injections are errors, not silent plain-text substitutions. No `latest` downloads during golden generation or normal CI. Oracle adapters run in isolated contexts so changing themes or registries cannot contaminate another test.

Do not upload private source to a public corpus. Inspect upstream asset licenses and fixture provenance individually. A repository's top-level license does not automatically establish the provenance of every bundled sample. Fetch-by-hash manifests may be preferable to vendoring large third-party trees.

### 9.2 Test lanes

| Lane | Inputs | Purpose |
| --- | --- | --- |
| Oracle conformance | `vscode-textmate` first-mate/suite1/while suites and adapter self-tests | Verify registry, state, budgets, and extraction independent of native languages. |
| Language regressions | VS Code colorization fixtures; TypeScript-TmLanguage tests; selected grammar-maintainer tests | Exercise production grammar behavior. |
| Annotated expectations | Adapted tmgrammar and Tree-sitter highlight fixtures | Pin targeted positive/negative expectations with correct preprocessing. |
| Catalog smoke | Pinned Shiki catalog samples and language registry | Account for breadth, aliases, and unsupported entries. |
| Adversarial editor cases | Original synthetic fixtures and edit replays | Exercise broken code, Unicode, EOLs, limits, and injections. |
| Held-out real code | License-reviewed files, disjoint by provenance/hash from tuning data | Evaluate generalization beyond hand-tuned samples. |
| Consumer integration | Syntax-only VS Code captures and later Singapore/Fregat adapters | Verify registration, theme normalization, transport, and rendering contracts. |

Do not count artificial oracle grammars as unsupported native languages. Do not count an annotated assertion as full-file scope coverage. Deduplicate corpus entries and report the provenance of every case. [R1, R4, R5, R8, R10, R11]

### 9.3 Canonical output

Use an engine-neutral logical schema:

```text
DocumentResult
  sourceHash, profileId, languageId, documentRevision
  status: complete | unsupported | timeout | error | canceled
  spans: [fromUtf16, toUtf16, orderedScopes, metadata]
  stylesByTheme: normalized style spans
  diagnostics, engineIdentity, elapsedWork
```

Expanded scopes are acceptable in offline goldens; production uses interned IDs. Keep timing out of content-deterministic golden equality.

Raw TextMate extraction must carry state through every physical line, including empty lines, according to that profile. Handle any synthetic line terminator produced by the tokenizer without inventing source characters. Clip only documented sentinel output, not legitimate scopes. Preserve a mapping between normalized per-line input and exact source offsets.

Shiki's own empty-line and token-length behavior is recorded separately, not silently replaced by raw TextMate behavior. The harness first demonstrates whether such differences affect a given fixture. Ordinary golden generation must detect stopped-early results or failed reference work rather than treating incomplete output as truth. Use a process deadline for pathological oracle cases even when internal accuracy-mode budgets are disabled. [R7]

### 9.4 Comparison without tokenization artifacts

Build a sweep over the union of span endpoints from both outputs. Compare the semantic assignment on each resulting interval. Coalesce equal adjacent assignments for boundary diagnostics, and retain raw token boundaries only as an additional diagnostic.

Do not allocate a full per-character object array for large files. A streaming interval comparison avoids turning the test harness into the memory problem being investigated.

For each successfully referenced document and theme, report:

- Exact ordered scope-path agreement, preserving scope names, order, and ancestors.
- Exact resolved style agreement, plus separate foreground and font-style disagreement counts.
- Embedded-language and token-type agreement where that profile exposes them.
- Boundary precision/recall after canonicalization, diagnostic rather than a substitute for assignment agreement.
- Mismatch lengths, counts, longest contiguous mismatch, affected files, and mismatch categories.

Compute length-weighted agreement as matching UTF-16 units divided by comparable UTF-16 units. Also report non-whitespace agreement and macro averages per file, language, and theme. Keep all-text results; whitespace may carry meaningful enclosing scopes. Empty denominators are N/A, not automatic 100%.

Publish coverage denominators separately: catalog languages, runnable fixtures, supported fixtures, complete references, and completed comparisons. Unsupported, skipped, timed-out, and errored cases never count as correct. Large default-colored files must not hide a broken small language or critical fixture behind an aggregate score.

### 9.5 Theme corpus and adversarial selectors

Use a small diverse real-theme set for fast PR jobs, then all themes in the locked target catalog in the expanded lane. Inventory selector features, not just popular theme names. Cover light/dark/high-contrast defaults, contextual selectors, explicit style resets, punctuation, and language-specific scopes.

Generate synthetic discriminator themes for observed scope differences and independently authored matcher fixtures. For example, a rule targeting a missing ancestor can reveal a disagreement hidden by a broad `variable` rule. Derive discriminators from both outputs where useful so extra candidate scopes are tested as well as missing ones.

These tests improve evidence; they do not prove equivalence for every conceivable theme. Label all reports with the actual theme set and selector contract.

### 9.6 Diagnostics and edit generation

A minimized failure should include source/replay seed, first differing revision and range, both ordered scope paths and styles, winning theme rule, AST ancestor/field information, captures, responsible pack rule IDs, injection context, parser errors, and reproduction command.

Use deterministic, bounded edit generators: insert/delete/replace, delimiters, newline changes, paste, undo/redo, and multi-edit batches. Bias toward token and injection boundaries. Compare fresh reference, fresh native, and incremental native after every step; do not compare incompatible internal state objects.

Separate mapping-development data from evaluation data. Once held-out failures are used to tune a pack, mark that set as development data and refresh the holdout. Minimize failures into small regressions, but preserve the original seed/provenance for reproducibility.

## 10. Performance and memory experiment

Compare equivalent work in separate lanes:

1. **Shared-tree scope cost:** tree already exists; measure classification, interval composition, theming, and output transport.
2. **End-to-end editor syntax cost:** include text edits, structural parsing, injections, highlighting, and consumer delivery on both sides. The baseline may already need Tree-sitter for structure in addition to Shiki for colors.
3. **Cold open:** include engine/module initialization, lazy language/theme loading, parsing, and first useful output.

Compare against the agreed current incremental Shiki implementation. Disable diagnostic explanations on both sides for the production-like lane; measure diagnostics separately. Never compare whole-document reference output with viewport-only native output as if they did equal work.

Reuse Plan 112's existing benchmark and coordinate with Plan 201's metric/attribution work. Reference grammar/theme locks remain deterministic correctness inputs; the performance control may be refreshed in a separately recorded run as Shiki and common rendering improve. Pending consumer measurements do not block the isolated harness or native prototype, but current comparable measurements are required before claiming end-to-end gains or approving a production cutover. Keep overlay, language-server and tokenizer costs separately attributed; do not count another plan's shared rendering fix as a native-engine speedup.

Measure cold/warm open, first viewport result, full completion, repeated edits, edits near the beginning, huge single lines, deep nesting, theme switches, view reopen/dispose cycles, and multiple documents. Use size/density buckets including small files, megabyte-scale files, and larger stress inputs; document exact fixture bytes and token density.

Report latency distributions and maximum stalls, bytes scanned, regions invalidated, copied/transported bytes, peak/live retained memory, Wasm capacity, token/scope counts, cache counts, and allocation/reclamation behavior. Separate source-buffer suffix movement from scope work while retaining both in end-to-end totals. Distinguish live allocations from Wasm's retained high-water capacity; capacity alone is not a leak diagnosis. [R14]

Record hardware, OS/browser/runtime/compiler versions, optimization flags, warmup policy, repetitions, and resource limits. Establish numeric cutover budgets from baseline measurements and product requirements before optimizing against the evaluation set. No speed or memory gate is claimed as passed in this plan.

## 11. Phases and stop/go gates

Each phase should become a separately reviewed implementation unit. The checkboxes below are intentionally unchecked. Cross-project prerequisites apply to the affected Phase 6 consumer cutover, not to the fork's isolated experiment; see [dependency order](#cross-project-dependencies-and-execution-order).

### Phase 0: lock target and inventory

- [x] Freeze the product profile and all source/grammar/theme/engine identities.
- [x] Inventory target languages, aliases, parser availability, scope-pack status, injection dependencies, and fixture sources.
- [x] Review provenance and license handling; choose vendored versus fetched assets.
- [x] Establish reference differences and document the primary target for each fixture class.
- [x] Record the current Shiki baseline identity and measurement protocol, reusing Plan 112/201 evidence where applicable. Collect pending end-to-end measurements in parallel and refresh them before Phase 5's release evaluation; do not block oracle/harness work on the concurrent Shiki optimization.
- [x] Record the required downstream contracts from 197 and 099/198 as Phase 6 prerequisites, without creating dependencies on their unrelated units or changing their authorization gates.

**Gate passed 2026-10-01** (PR #7, `test/highlight-compat/manifest/`, `docs/plans/textmate-scope-compatibility-inventory.md`; reference differences established in PR #12, `reports/reference-differences.md`).

**Gate:** a reproducible correctness manifest, explicit compatibility contract and named performance-control revision exist. Pending consumer performance runs do not block Phase 1. No parity claim is made without a denominator and a profile.

### Phase 1: trustworthy harness

- [x] Implement isolated oracle adapters and canonical interval/schema validation.
- [x] Add the upstream oracle suites, initial VS Code/TypeScript fixtures, annotation adapters, and original Unicode/EOL cases.
- [x] Add comparator self-tests for token splitting/coalescing, missing scopes, reordered scopes, extra scopes, default styles, empty input, clipping, and failed references.
- [x] Separate read-only test mode from explicit golden-update mode.
- [x] Produce baseline reports for simple capture mapping and, where compatible, VS Code queries.

**Gate passed 2026-10-01** (PRs #6, #10, #12, #13, #14, #15; evidence in `test/highlight-compat/reports/phase-1-gate.md`: 492/492 mandatory cases, two identical full regenerations in CI, ten consecutive identical regenerations in CI run 36815001134). Baselines against raw and product references: exact scope-path agreement 5.21–8.87% (non-whitespace 0–0.63%) while style agreement is 56–100%; historical assertions 2146/2148. Harness runtime is Node 26.7.0.

**Gate:** required oracle/conversion/comparator self-tests pass; repeated runs have identical content results. Expected oracle-profile differences are documented, not suppressed. Synthetic tokenizer-only grammars remain in the oracle lane.

#### Harness runtime: Bun trial

Status: Approved, runs after the Phase 1 gate.

The harness runs on Node 26.7.0 under Vitest. Node 24.21.0 crashed during golden regeneration with a V8 Wasm JIT assertion ([nodejs/node#66366](https://github.com/nodejs/node/issues/66366), fixed upstream in [v8@9b8ca54d5a](https://github.com/v8/v8/commit/9b8ca54d5a)), triggered by the oracle workers' Wasm churn. Fregat already runs its app tests with `bun --bun vitest`.

- [ ] Run the full harness under `bun --bun vitest`: typecheck, the full suite, `fixtures:check`, and ten complete `regenerate --check` passes, with goldens byte-identical to the Node results.
- [ ] If it holds, move the harness and its CI to Bun with a pinned version, and drop the Node pin.
- [ ] If it fails on a runtime bug (worker or Wasm behaviour), record the failing command, the error and any upstream issue here, keep Node 26.7.0, and move on. Do not add workarounds for a runtime bug.

### Phase 2: native full-pass pilot

- [ ] Prove existing-tree/shared-source operation through the current extension seam.
- [ ] Implement deterministic full-document scope composition and the minimum supported native predicates.
- [ ] Start with TypeScript and TSX as explicit variants, plus JSON as a simpler control. Record JavaScript/JSX as distinct variants rather than assuming TS coverage implies them.
- [ ] Add one mixed-language pilot, such as Markdown fences containing TypeScript, before concluding that the architecture generalizes. For Markdown, reuse the parser/runtime integration recorded by 176 and verify the current release; do not wait for every 189 improvement or recreate its document owner.
- [ ] Compare native scopes using the reference matcher and emit minimized mismatch reports.

**Gate:** memory/ownership/schema safety tests pass; the candidate improves on named baselines without altering the oracle. Publish actual remaining mismatches. No cutover based solely on a favorable aggregate percentage.

### Phase 3: incrementality and injection ownership

- [ ] Implement conservative invalidation with old/new edit spans and declared rule dependencies.
- [ ] Integrate borrowed injected trees or explicitly owned injection sessions with disposal and source maps.
- [ ] Add seeded edit replay, same-shape predicate edits, viewport/full equivalence, batch edits, and undo/redo.
- [ ] Add cancellation, revision, memory-growth, and multi-view lifetime tests.

**Gate:** 100% equality between fresh and incremental native output on the required deterministic/replay suite; no stale-revision publication, invalid spans, crashes, or unbounded tested retention. This is an acceptance requirement, not a measured result. External TextMate differences remain separately reported.

### Phase 4: native theme resolution

- [ ] Implement normalization/matching boundaries and content-revision cache identities.
- [ ] Differential-test the native matcher with reference scopes before combining it with candidate scopes.
- [ ] Run real-theme and synthetic discriminator suites, including style resets and parent selectors.
- [ ] Verify theme changes do not parse source or resynthesize scopes; verify concurrent themes and disposal.

**Gate:** all required matcher contract fixtures pass exactly; any unsupported selector/property is explicit. Product-style parity is measured independently of scope parity.

### Phase 5: broaden coverage and characterize cost

- [ ] Extend to JavaScript/JSX, Python, Rust, HTML/CSS, Markdown variants, shell/heredocs, and further catalog languages in evidence-driven waves.
- [ ] Exercise grammar-specific hard cases: YAML indentation, C/C++ preprocessing, SQL dialects, nested injections, and incomplete source as their packs are added.
- [ ] Run the locked theme catalog and held-out corpus; publish per-language/theme results and unsupported entries.
- [ ] Run the performance/memory protocol against the current agreed Shiki and common-rendering baseline, define explicit product cutover budgets, and provide evidence to Plan 201's step 4 decision without blocking its overlay work.
- [ ] Decide for each mismatch class whether to fix the pack/parser, accept a documented deviation, or keep that pack experimental.

**Gate:** each promoted pack passes its mandatory exact fixtures and agreed numeric coverage/style/scope/performance thresholds. Thresholds are approved before the release evaluation, not retrofitted to the score. Full catalog accounting is mandatory even when only a subset is promotable.

### Phase 6: downstream integration and eventual removal

- [ ] For each consumer cutover, record the exact landed commits and acceptance evidence for the contracts it needs: 197's service/provider and diff ownership; for retained documents, 099's canonical publication/relevant adapter contract and 198's acquisition, revision/range/configuration admission, cancellation, retention and attachment. Reuse landed code. Do not require unrelated units or bypass any remaining authorization gate.
- [ ] In later Singapore/Fregat PRs, integrate the backend through 197's service and existing provider/session and packed-token boundaries after re-inspecting their current APIs. Standalone snippets do not acquire a retained document merely to satisfy 198.
- [ ] Reconcile 197's imported-theme wording in the consumer PR: preserve approved highlighting behavior and coverage, with Shiki as the initial backend rather than a permanent API requirement. Keep existing production selection until this migration is accepted.
- [ ] Preserve folding, selection, brackets, injections, diff/prepared-document behavior, viewport queries, and theme switching without duplicate document owners. Preserve 170's loading/warm-up and 200's landed source/attachment contracts where present; do not make full 200 completion a new prerequisite.
- [ ] Test the same source/theme across editor, diffs, previews, and Markdown consumers where they share the supported contract.
- [ ] Promote only approved packs; retain the application's pre-existing behavior outside the experiment until an explicit migration decision.
- [ ] Remove Shiki/TextMate from the selected production path only after coverage is approved; enforce a dependency/build artifact check proving they are not accidentally bundled by the optional component.
- [ ] Document remaining limitations and the final coverage contract before advertising broad theme compatibility.

**Gate:** the affected consumer's named prerequisite contracts are proven, current compatibility/performance evidence is reviewed, and a rollback procedure exists. This phase requires separate changes outside this repository; this plan does not authorize or perform them. A full removal must not silently drop previously supported languages. Other plans do not wait for this gate to ship their existing-backend work.

## 12. CI and maintenance contract

Proposed fast jobs cover harness self-tests, mandatory language fixtures, a compact real/synthetic theme set, deterministic edits, native safety tests, and browser/Wasm smoke tests. Expanded jobs cover all locked themes, broader corpora, more seeds, and controlled performance runs. Workflow implementation belongs in a later PR.

Normal CI reads goldens and fails on unexpected changes. A dedicated reviewed command regenerates them from the reference only, attaching old/new lock identities and a diff report. Never approve candidate output by making it the new oracle. A grammar upgrade is a versioned compatibility event with a changelog and regenerated reference report.

Keep scope packs versioned against both Tree-sitter grammar and TextMate reference identities. Ownership should be explicit by component: harness, native runtime, language packs, theme matcher, and downstream adapters. Assign actual maintainers during implementation rather than inventing names here.

For implementation changes, reconcile tests with the fork's current contribution instructions, including `cargo xtask fetch-fixtures`, native tests, and Wasm fixture/test steps where applicable. Add address/undefined-behavior sanitizers for native scope code and schema validation for output buffers. Commands in the contribution guide must be rechecked before use. [R20]

## 13. Risks and decision rules

| Risk | Mitigation and decision rule |
| --- | --- |
| Scope parity stalls despite good-looking themes | Inspect missing context/sub-token/recovery categories. Expand packs or report a narrower compatibility contract; do not claim all themes from a finite sample. |
| Native predicate behavior differs from imported queries | Enforce a supported dialect, differential predicate fixtures, and fail-closed pack validation. |
| Same-shaped tree edits leave stale scopes | Include text edits and declared dependencies; require fresh/incremental equivalence. |
| Injections create duplicate parsing or broken offsets | Integrate with document-owned trees, explicit source maps, and ownership tests. |
| Compact output still retains excessive state | Track source/tree/scope/style/cache/transport ownership separately and test repeated lifecycle operations. |
| Fast visual scores hide missing languages or comments | Publish catalog and failure denominators, per-language macro results, mandatory exact cases, and non-whitespace diagnostics. |
| Reference changes invalidate historical scores | Lock all assets and settings; regenerate through an explicit upgrade workflow. |
| Error recovery cannot match selected lexical behavior economically | Preserve the mismatch and make a product decision. Do not smuggle in a second native tokenizer as an unreviewed fix. |
| Shared memory is mistaken for isolation or cross-worker safety | Trust only approved modules; specify synchronization, revision, and lifetime rules explicitly. |
| Cross-plan dependency cycles or duplicate owners | Keep the fork experiment independent, use 197 and the relevant 099/198 contracts only at consumer cutover, preserve 200/201's independent delivery, and do not reopen rejected SAB transport work. |

## 14. Completion criteria for this planning PR

This PR is complete when the research dossier and this plan are reviewable in the owner's fork, the evidence/assumptions and unrun experiments are distinguishable, and no runtime source, dependencies, fixtures, goldens, or workflows have been changed.

Review should settle the initial product profile, pilot language set, optional-component ownership, phase gates, and the contract-level cross-plan dependencies. Implementation and measured parity remain future work under separately reviewed changes. The Fregat roadmap and owning plans keep their execution and authorization authority; this documentation does not rewrite their queue or statuses.

AI assistance: researched and drafted at the fork owner's explicit request. No upstream PR, human-review claim, or runtime implementation is implied.
