# Internal scope measurement protocol

`npm run --silent measure` emits diagnostic JSON. It makes no performance, parity, budget acceptance, promotion or cutover claim. The two explicitly labeled adapters measure different work. They never share a latency distribution or act as fallbacks for each other.

## Command

Build the existing runtime, component, observer and web binding, then install the frozen harness dependencies. The loaders check component freshness and parser identities. No new native ABI or dependency is required.

From `test/highlight-compat`:

```sh
npm run --silent measure -- --adapter full-pass-reference --language json --repetitions 2 --warmups 0
npm run --silent measure -- --adapter session-native --case builtin:json-lifecycle-v1 --repetitions 2 --warmups 0
npm run --silent measure -- --adapter session-native --case /absolute/authored-case.json --lane shared-tree --repetitions 2 --warmups 1
```

`full-pass-reference` remains the default. Existing `--language`, `--source`, `--lane`, `--repetitions` and `--warmups` arguments keep their behavior. Built-in sources exist for JSON, TypeScript and TSX. Source files decode as strict UTF-8 with BOM and line endings preserved. The existing report remains `scope-compat/measurement@1`, now explicitly labeled `full-pass-reference`.

`session-native` requires `--case`. It rejects `--source` and `--language` overrides. There is no executable module argument or plugin loader. Repetitions are 1 through 100 and warmups are 0 through 100. Cold workers always have zero warmups and one repetition each. Unknown or duplicate flags fail before worker dispatch.

Both adapters use the existing supervisor. Each worker has a 120-second deadline and a final 32 MiB combined-output guard. POSIX controller SIGINT or SIGTERM stops the worker process group, escalates after one second if needed, and waits for reaping. Windows termination covers the direct child only. This is not cancellation inside a synchronous native call. Forced controller termination remains outside this guarantee. The command starts no server and writes no files. Retain stdout outside the checkout.

## Session case

A case is one root-only JSON document, one nonempty edit batch and exactly two JSON theme strings. These fields are exhaustive:

```json
{
  "language": "json",
  "source": "[1,2]\n",
  "edits": [{ "from": 1, "to": 2, "insert": "3" }],
  "themeJson": [
    "{\"tokenColors\":[{\"settings\":{\"foreground\":\"#123456\",\"fontStyle\":\"\"}}]}",
    "{\"tokenColors\":[{\"settings\":{\"foreground\":\"#abcdef\",\"fontStyle\":\"\"}}]}"
  ],
  "profile": "product",
  "framing": "identity-v1"
}
```

Edits use base-coordinate, half-open UTF-16 offsets. The existing `prepareEdits` validates and schedules them. The controller and every actual owner, fixed control and fresh comparator use the same frozen numeric limits. There is no second edit algorithm. Themes have one local root resource and no includes. Normalization uses actual checked `nativeThemeTargets()` identities. Invalid or unsupported normalization rejects the invocation. Empty sources and equal themes are valid; only the fixed observer control requires visibly different A and B styles.

| Boundary | Safety ceiling |
| --- | --- |
| External case file, before decode or parse | 8 MiB exact bytes, descriptor read consumes at most ceiling plus one |
| Serialized worker request, before spawn and parse | 16 MiB UTF-8 JSON |
| Initial, each descending intermediate and final source | 1,048,576 UTF-16 units |
| Aggregate inserted text | 1,048,576 UTF-16 units |
| Edits | 1 through 16 |
| Each theme string | 65,536 UTF-8 bytes |
| Each canonical checkpoint | 4 MiB UTF-8 JSON |
| Entire successful invocation | 16 MiB UTF-8 JSON, including envelope, all workers, raw samples, controls and distributions |

These are harness safety ceilings, not product performance budgets. Small injected test limits exercise exact and first-over cases; they are not user flags. JSON byte counting precedes large encoding. Checkpoint expansion reserves bounded records before appending. The controller grants each worker at most its remaining invocation budget, with room reserved for controller records. Workers validate and enforce that private budget. Any failed or oversized run aborts the whole invocation. It emits no success report, distribution or selectively retained samples.

## Session lane boundaries

| Lane | Work and timing | Release boundary |
| --- | --- | --- |
| `cold-open` | Fresh process per repetition. Dynamic import, actual assets, instrumented allocation/query/scratch setup, normalization, owner parse, scopes, native A presentation and bounded semantic encoding. First-output time ends after encoding. OS caches are uncontrolled. | Caller release, detach and owner disposal are separate from first-output time. Launch-to-exit includes everything, including fresh comparators. |
| `shared-tree` | One parsed owner survives all warmups and samples. Each iteration attaches a new view, computes fresh full scopes, selects A and encodes. It observes zero parse calls and one classification. | Per-iteration release and last detach are timed. Final owner disposal is separately recorded. No current scope cache survives into the next iteration. |
| `end-to-end-adapter` | A fresh owner parses, computes initial A, applies the real edit batch, computes edited A, then selects B on the same generation. Open-to-output, edit-to-output, theme-to-output and disposal have separate records. | Direct lifecycle time includes all release and owner disposal. Subintervals end at their encoded checkpoint. |

This is harness adapter work, not editor syntax delivery. It includes no injection analysis, worker token delivery, renderer, pixels, overlays or LSP. Zero configured injections is not injection coverage. Parsing and classification/composition are not assigned invented subtractive stage durations.

The fixed work identity includes `checkpointRetention: release-initial-hold-edited-a-through-b-1`. Initial caller style and full-scope leases release after encoding and before editing. Edited A retains both leases through B selection and encoding. B acquires its own current full-scope and presentation leases. Release B style, B scope, A style, A scope before last detach. A's presentation pair preserves path encoding; a raw scope lease alone does not. Last detach must leave zero logical output charge while the owner remains ready. Warmups and comparators follow the same applicable schedule.

Fresh correctness comparators run after measured owners close. Initial A uses a fresh initial-source owner. Edited A and B share one fresh final-source owner and retain A through B. Comparator time is outside samples and separately labeled inside launch-to-exit. Compare matching semantic checkpoint hashes across lanes and repetitions, never initial versus edited or A versus B. Digests include exact UTF-16LE and WTF-8 source identities, coverage, decoded ordered scope names, coalesced boundaries, native named styles, theme content identity, profile, framing, completeness and explicit null metadata. Admission keys remain separate.

## Observation controls and accounting

Every warm worker arms the actual runtime and component before samples. Real query, buffer, parser, owner/tree and component scratch retention controls require positive allocation deltas and reclamation. Actual parse, edit, scope and native theme controls require positive call observations. Fixed theme B must change styles with zero parse/classification and stable scope generation. Disabled individual observers fail before samples. Hooks preserve call receiver, arguments, result and thrown identity, restore full descriptors, unwind partial installation and restore idempotently. No production owner diagnostic option is added.

Cold workers run only non-parsing query/allocation/scratch controls. Parse, scope, theme and decoded-statistic observers remain explicitly unavailable there because their positive controls would precondition first output. No different worker's control establishes cold call coverage. Instrumented initialization is not production cold-start latency.

Snapshots keep these quantities separate:

- Routed requested live bytes and blocks, cumulative requested-byte high water, calls and unknown frees.
- Component-managed live allocation blocks.
- Retained Wasm linear-memory capacity.
- Process memory observations.
- Actual `ScopeSession.retainedBytes()` logical `OutputStore.bytes()` charges.
- Adapter-held owner and lease counts and logical source-view bytes.
- Actual decoded `Component.run` segment slice bytes and native capture/interval statistics in armed warm contexts.
- Bounded semantic encoded payload bytes, not transported bytes.

No field invents scans, measured invalidation, source suffix movement, physical cache ownership, cache cardinality, allocator overhead, complete native peaks, per-stage peaks, JS ownership, all-copy totals or downstream transport. Full-document invalidation ranges are policy-derived extents. Runtime/component/language singletons have no disposal API. Their static storage and capacity retire at process exit. Zero document charge does not claim that process-lifetime storage was freed or that GC ran.

The session report is `scope-compat/session-measurement@1`. Worker reports use `scope-compat/session-worker@1` and validate schema, PID, lane-specific sample and checkpoint sequence, counts, durations, admission/source/theme identities, cold availability and retention. Operational failure envelopes have no success arrays. Raw samples, nearest-rank min/p50/p95/max, initialization, controls, shared preparation/disposal, comparator and launch-to-exit boundaries remain distinct. Instrumentation costs stay in the interval where they execute. `reportEncodingValidationMs` records one bounded pre-emission counting and encoding pass. Final wire encoding stays outside samples and inside launch-to-exit. There are no CI latency thresholds or cross-lane speedup ratios.

## Full-pass/reference adapter

The existing adapter still calls native full-pass scopes and the four pinned product reference themes through `paintScopes`, then encodes its existing document representation. It does not edit the delivered mutable owner or use native presentation. Its shared-tree iteration excludes parsing; new-owner iterations include one parse and disposal. Every measured engine proves query allocation coverage before source work. The separate broader control worker remains supplementary. Catalog accounting remains diagnostic, not a language score or current consumer baseline.

## Identity and remaining gates

Reports reuse repository head/status/content identity, environment and actual loaded engine evidence. Case bytes, policy, theme bytes and exact source identities are separate. Repository changes during a run fail it. Component source manifest, compiler/flags, observer, runtime/binding, parser, pack, query and policy identities come from the existing checked loaders. Runtime compiler flags, host quietness and ancestor resource restrictions stay unavailable unless separately observed.

Tiny configured tests exercise native controls, fresh equality, bounds, packet-encoding retention, failure unwind, descriptor restoration and supervisor reaping. They do not run a timing campaign or alter frozen evaluation evidence. Current incremental-Shiki consumer controls, equivalent downstream work, preselected product budgets, independent source review, full applicable intake, green CI and merge remain parent-owned gates. This local implementation checkpoint satisfies none of those acceptance decisions by itself.
