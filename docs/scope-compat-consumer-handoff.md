# Immutable scope adapter consumer handoff

Status: experimental fork preparation. Phase 2 acceptance and Phase 6 cutover remain open. No pack promotion, production backend selection, or performance benefit is established here.

This reference describes the private `test/highlight-compat` adapter inspected at `bb0f0945f92507d980312141a2e933ea3e33e275`. It is not a shipped production backend or consumer SDK. The [roadmap](plans/textmate-scope-compatibility.md) and [inventory](plans/textmate-scope-compatibility-inventory.md) retain the wider acceptance work. Designs 008 and 009 are under amendment, not implemented APIs. Their retained-session and native-theme tests wait for actual implementations.

## Existing entry points

All paths below are relative to `test/highlight-compat/`.

| Entry point | Current behavior |
| --- | --- |
| `src/native/owner.ts`: `PilotDocument.open(languageId, source)` | Asynchronously opens one immutable exact-source buffer, parser, and tree. `dispose()` releases tree, parser, and buffer and is idempotent. |
| `src/native/packs.ts`: `loadLanguagePack(languageId)` | Loads exact IDs `json`, `typescript`, or `tsx`. Other IDs reject. Root aliases and filename inference are absent. |
| `src/native/adapter.ts`: `nativeScopes(pack, owner, window?)` | Synchronous scopes over the owner's existing tree. The default window is the complete source. |
| `src/native/component.ts`: `NativePack.run(borrow, window, limits?)`, `explain(...)` | Private harness access to native limits and diagnostic intervals. Not permanent public handle APIs. `dispose()` releases the pack once. |
| `src/native/adapter.ts`: `nativeDocument(pack, owner, reference)` | Asynchronous logical result with fixed reference theme tracks. `reference` is exactly `'raw'` or `'product'`, not acquired theme content. |

The following workflow is exercised by `tests/native-consumer-contract.test.ts`, including cleanup after failures. From the harness, after the existing runtime/component and binding build:

```ts
import { loadLanguagePack } from './src/native/packs.ts';
import { PilotDocument } from './src/native/owner.ts';
import { nativeDocument } from './src/native/adapter.ts';

const pack = await loadLanguagePack('json');
try {
  const owner = await PilotDocument.open('json', '[1,2]');
  try {
    const result = await nativeDocument(pack, owner, 'product');
    if (result.status !== 'complete') throw new Error(result.diagnostics.join('\n'));
    // result is owned harness output with Shiki/TextMate reference painting.
  } finally { owner.dispose(); }
} finally { pack.dispose(); }
```

Setup can reject before a document result exists. Disposal prevents subsequent native use. It does not cancel asynchronous reference painting already supplied with copied intervals. Overlapping calls execute their native scope passes synchronously and may overlap while loading/painting reference themes. This proves independent immutable requests, not parallel native execution, shared pending work, view interests, or late-result admission.

## Exact source, identity, and owned output

| Contract | Implemented limit |
| --- | --- |
| Source | Exact JavaScript string, including BOM, CRLF, LF, bare CR, astral characters, combining characters, and lone surrogates. No normalization. Native encoding is UTF16LE, ABI value `1`. |
| Offsets | Half-open UTF-16 code units. `sourceLength` is `source.length`. A raw window is not a general proof of viewport/full-context equivalence. |
| Source digest | SHA-256 of WTF-8. Well-formed strings use ordinary UTF-8; lone surrogates retain their three-byte encodings and differ from U+FFFD. |
| Revision | `nativeDocument` always uses builder default `documentRevision: 0`. No edit, revision/epoch admission, stale-response rejection, cancellation, or `AbortSignal` input exists. Schema fields and the schema's `canceled` variant implement none of those modes. |
| Raw scopes | Status `0` contains `Uint32Array` segment triples, decoded path arrays, and statistics. Segments tile the window and coalesce adjacent identical paths. Path IDs belong to that result; scope IDs belong to that pack's `scopes`. IDs cannot be compared across independent dictionaries. |
| Separators | Native scope paths are empty for LF and both units of CRLF. Bare CR retains ordinary scope handling. Reference painting emits `{}` for intervals consisting exactly of LF or CRLF. These are explicit harness conventions. |
| Logical output | Schema `1` contains source identity, language, engine identities, scope names/paths/spans, and reference style tracks. This adapter supplies no editor metadata track or packed editor transport. `parseResult(value, source)` checks source identity and layout, not publication admission. |
| Copy ownership | Native buffers are freed in `finally` after decoding copies. Returned arrays survive owner/pack deletion and Wasm heap growth. Separate calls own separate arrays. TypeScript `readonly` and builder sealing do not deep-freeze caller output. |
| Lifetime | Owner and pack disposal are explicit and independent. Borrow validates live handles, source/tree buffer identity, length, and language identity. It cannot validate same-length mutable edits against stale structure. The immutable owner avoids that mutation today. |

The test uses independently specified WTF-8 bytes, raw-to-logical scope decoding, fresh-owner equivalence, overlapping reference calls, output mutation isolation, heap growth, and allocation reclamation. Allocation controls arm in the same Vitest process before its runtime initializes. The observer counts core allocator pointers; `Component.liveAllocations()` counts component blocks. Neither is retained-capacity measurement or proof of another subprocess's coverage.

## Supported experiment and reference themes

All three packs use `pilot-1`. Their root scopes are `source.json`, `source.ts`, and `source.tsx`. Ordered query paths and parser hashes come from `lib/scope-compat/packs/<id>/pack.json`. TypeScript and TSX include the shared TypeScript query first. Existing reports retain actual mismatches; successful schema output is not scope/style parity or promotion.

`nativeDocument` calls `src/baselines/theme.ts`, which imports Shiki normalization and `@shikijs/vscode-textmate@10.0.2 Theme`. Its four fixed tracks are `github-dark`, `light-plus`, `dracula`, and `vesper`; empty source omits style tracks. The reference profile selects normalization behavior. Foreground/font projection does not establish arbitrary background/reset parity. There is no arbitrary theme input, native matcher, content-revision identity, theme handle, lease, concurrent same-name/different-content theme support, or theme-switch admission contract.

The immutable Markdown pilot has a separate `MarkdownPilotDocument.open(source)` / `intervals(packs)` / `document(packs, reference)` / `dispose()` boundary. It uses resolver `f02e277a34375f326572b4ade2602f44ac769005`, flags `3`, and original-source included ranges for simple contiguous JSON/TypeScript/TSX fences. Its child aliases use pinned reference registrations. Empty, unknown, recursive Markdown, and nested containers needing disjoint ranges remain explicit diagnostic/frame-only cases. It is not the product's Markdown owner or a general injection registry. JavaScript, JSX, regex, jsdoc, phpdoc, and other root languages have no accepted pilot pack. Missing coverage stays outside successful parity denominators.

## Failure boundaries

| Boundary | Actual outcome |
| --- | --- |
| Owner/runtime/pack setup | Promise rejection on acquisition, identity, loading, or parse failure. Unsupported pack ID is also a loader rejection. |
| Raw native pass | `0` success; `1` unsupported; `2` budget; `3` invalid; `4` no-memory. Failures contain only status/detail/value, never partial segments. Budget is not cancellation. |
| Raw validation/decode/disposed handle | Throws. A deleted owner or pack cannot start another pass. Core allocation failures may abort, as documented by the experimental C ABI. |
| Logical absent pack or JS/JSX | `unsupported`, with empty names/paths/spans. Missing support is distinct from operational failure. |
| Logical native budget | `timeout`, with empty output. The high-level wrapper has no caller limits input today. |
| Logical native invalid/no-memory or caught execution/painting exception | `error`, with diagnostics and empty output. `nativeDocument` catches disposed-handle errors on the supported-pack path. An absent pack returns unsupported before borrowing, even with a disposed owner. |

## Artifact boundary and repeatable checks

The optional C Wasm component is separate from the generic parser package and contains no Shiki/TextMate/Oniguruma runtime import. That statement applies to the built component boundary. The current harness adapter intentionally imports reference theming and cannot satisfy a blanket no-Shiki runtime rule.

`cargo +1.98.1 xtask build-wasm`, `cargo +1.98.1 xtask build-scope-compat`, and the binding's frozen install plus `npm run build:ts` produce the actual inputs. `tests/native-component.test.ts` checks the built module's allowlisted imports, exports, ABI, manifest freshness, complete input inventory, and generic-package exclusion. Forbidden parser links have deliberate negative controls. No new package or host bundle is defined here. A future production adapter needs inspection of its actual emitted chunks, imports, assets, and packed files, with a deliberate forbidden dependency control.

Engine identity includes `componentSha256`, `sourceDigest`, `runtimeSha256`, `abi`, `packId`, `packVersion`, `querySha256`, `parserSha256`, `composition`, and `predicateDialect`. Runtime identity hashes loaded JS plus Wasm; source identity hashes build inputs rather than moving Git HEAD. Current composition is `scope-compat-compose-1`; predicates are `eq/any-of/make-range/priority`. Theme/reference/corpus identities remain separate. Exact built hashes belong to the run's evidence, never copied from an older report.

Focused verification is `npm --prefix test/highlight-compat test -- tests/native-consumer-contract.test.ts tests/native-component.test.ts`. Existing gates include harness typecheck/full tests, `fixtures:check`, `artifacts:check`, `report:native -- --check`, and strict tracked-import checks. This documentation/test-only unit does not alter native code or justify repeating unchanged sanitizers. Full actual Complete CI, independent review, publication, and merge remain required parent gates.

## Missing evidence by consumer

Every row below is missing current landed signatures, import paths, owner repository/commit, independent acceptance, test commands, and commit-bound result artifacts. No consumer source was inspected here. Historical plan labels are routing clues only. Requests go through the parent to the owning lanes later; this packet sends none.

| Consumer | Exact later owner-lane request | Relevant boundary |
| --- | --- | --- |
| Standalone snippet | One-shot service request/result union, exact UTF-16 source/hash rules, language inference/aliases, acquired-theme content identity, immutable output, disposal/cancel/late reply and unsupported/failure distinction. | One-shot service only; no retained document prerequisite. |
| Settings preview | Above plus theme acquisition, replacement/close signatures, overlapping same-name/different-content themes, out-of-order completion, loading state, and disposed-preview admission. | Existing preview/service and theme owners. |
| Rendered Markdown fence | Actual fence extraction/source map and service declarations; exact-content cache keys, aliases/registration closure, stream supersession, theme change, cold plain text, unknown/empty/nested/recursive behavior. | Existing Markdown/service owners; retained hooks only if actually retained. |
| Retained editor/provider | Provider factories, packed payload/store/full-patch coordinates, authoritative before/after source and edit order, revision/range/configuration admission, acquire/cancel/retain/attach, folding/selection/brackets/injections/viewport evidence. | Existing service, canonical publication, retained analysis; implemented 008 and native themes where required. |
| Prepared diff | Existing preparation/store acquire/release declarations, exact per-side source/configuration keys, shared pending work, bounded eviction, canceled interest and terminal disposal. State immutable/retained mode per side. | Existing diff syntax owner; retained sides alone need canonical/analysis hooks. No second diff cache. |
| Live diff | Prepared-diff evidence plus attach/update/detach signatures, paired text/token revision admission per side, edits during preparation, detach/reopen. | Relevant canonical/analysis contracts for retained sides and implemented 008. |
| Retained hover | Acquire/range/close declarations, exact live/snapshot source origin, range/configuration identity, late-result rejection, paired attachment and release. Confirm whether it is instead an immutable one-shot snippet. | Reuse retained analysis only for actual retained mode. |
| Multiple views | Shared analysis acquisition, independent per-view range/theme/configuration interests and cancel/detach, last-interest policy, dirty-text/undo preservation; detaching one leaves another usable. | Implemented 008 shared lifetime and 009 theme presentation; no parallel document owner. |
| Comparison/historical/operation/lightweight preview | Separate actual source-result unions and attachment declarations per subconsumer, unsaved-live versus immutable snapshot identity, mapping, partial/truncated/binary/unavailable outcomes, retention and diff ownership. | Only relevant landed source contracts; retained hooks conditional on actual mode. |

All rows additionally lack 010's reviewed per-pack promotion and a current equivalent-work incremental-Shiki control. The checked-in product tokenizer is a historical correctness port. Local immutable-adapter measurements do not establish current consumer performance. Later evidence must name the landed implementation and executable benchmark, service/worker/provider/renderer commits, engine/grammar/theme hashes, exact source/edit sequence, line limits, range/context/metadata/injection work, warm state, and completion semantics. It must show actual incremental edits. Cold initialization, shared-tree classification, and end-to-end syntax/delivery are separate comparisons on the same host with equivalent work. Raw samples, toolchain/flags, warmups/repetitions, copied bytes, live allocations versus retained capacity, and unavailable metrics must remain explicit. No numerical threshold or speed claim follows here.

## Promotion and rollback gates remain open

Promotion needs reviewed pack/parser/query/component/runtime/reference/theme/corpus identities, an explicit language/alias/injection/theme subset, mandatory fixture and scope/style/metadata evidence, accepted deviations, applicable green CI, and the affected consumer's acceptance record. Designs 008/009 and a successful immutable test suite do not fulfill these gates. Retained/session/theme lifecycle tests wait for their real implementation; a hash comparison is not a stale-publication test.

Before an owning consumer PR changes selection, it must record the current production backend/artifact and selection point. It must exercise restoring that selection, stopping/releasing new work, rejecting late replies, and recovering highlighting while preserving dirty text, undo, and other interests. Existing behavior remains outside the promoted subset. Reconcile imported-theme wording there to preserve approved observable scopes/colors/coverage without making Shiki's initial backend identity permanent.

No new journal, cache, diff owner, transport change, worker consolidation, fallback negotiation, downstream edit, or whole-roadmap prerequisite is introduced. The downstream integration/removal boxes stay unchecked until each owning PR supplies its accepted evidence. Broad imported-theme compatibility and full removal also require accounting for every previously supported language and theme behavior.
