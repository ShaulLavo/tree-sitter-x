# Internal prototype measurement protocol

`npm run --silent measure` emits one JSON diagnostic report for the existing full-pass prototype. It does not establish a performance benefit, budget acceptance, pack promotion, or consumer cutover. Phase 2 remains an open, limited experiment, including the four TSX original-corpus strict-improvement ties. Plans 008 and 009 are not implemented by this command.

## Command

The command requires the existing `cargo xtask build-wasm`, `cargo xtask build-scope-compat`, web binding TypeScript build, and frozen harness dependencies. It validates component freshness and parser identities through the existing loaders. It requires no new dependency or public native ABI.

From `test/highlight-compat`:

```sh
npm run --silent measure -- --language json --repetitions 5 --warmups 2
npm run --silent measure -- --language tsx --source /absolute/input.tsx --lane shared-tree --repetitions 10 --warmups 3
```

Languages are `json`, `typescript`, and `tsx`. Without `--source`, each language uses a tiny deterministic built-in fixture. Source files decode as strict UTF-8 with BOM and line endings preserved. The report hashes the submitted UTF-16LE code units and UTF-8 bytes. Counts accept 1 through 100 repetitions and 0 through 100 warmups. Cold runs always use zero warmups. Unknown options, unavailable packs, failed controls, native incomplete results, and changed source identities fail the command with a nonzero exit and no report.

Each worker has a 120-second timeout. The command starts no server and writes no files. Redirect stdout outside the checkout to retain a report. Run controlled measurements through the host's runner, honor owner reservations, and use the same host, runtime, build, input, and output work for any later comparison. OS caches are not cleared. Concurrent host activity can affect these instrumented elapsed times.

## Lane boundaries

| Lane | Timed work | Lifetime |
| --- | --- | --- |
| `cold-open` | Dynamic adapter import, runtime and language loading, test allocator setup, component and pack loading, parsing, full scopes, reference styles, and JSON encoding. | A fresh process per repetition. Latency ends at the first encoded output. Process launch through exit is reported separately. |
| `shared-tree` | Full native scope pass and decode, path expansion, reference styles, and JSON encoding. | One existing source and tree survive warmups and repetitions. Parsing and owner disposal are outside iteration timing. |
| `end-to-end-adapter` | New immutable source owner, structural parse, full native scopes and decode, path expansion, reference styles, JSON encoding, and owner disposal. | A fresh owner per iteration within a warmed worker. This is the harness adapter, not an editor integration. |

Every lane uses full-document output and the same four pinned product-reference themes. The command checks identical output hashes across repetitions and lanes. It asserts one observed parse per cold or new-owner iteration and zero extra parses for shared-tree scope work. There is no Shiki timing comparison, ratio, or native theme implementation. Classification and composition share one native call, so they are not assigned invented individual timings. Explanation diagnostics stay disabled; measurement instrumentation stays enabled.

Cold workers have no prior runtime initialization. Observer positive controls execute in a separate process before measurement loops. Warmup counts apply inside each non-cold worker. `initializationMs` includes adapter import and observer setup; cold initialization is instrumented diagnostic work, not a production-path timing. The first-output timestamp ends at local JSON encoding, not viewport presentation. Warm distributions include complete iteration lifetimes. Nearest-rank p50 and p95, minimum, maximum, raw samples, and process totals are reported without absolute CI timing limits.

## Observations and limits

The existing test allocator hook routes core allocations through observed runtime exports. Before measurements, executable controls retain and release a core query, a source buffer, a document, and component scratch storage. They prove positive live-allocation deltas and reclamation, one real parse, and no extra parse during scope work. A failed control prevents measurement loops.

Snapshots distinguish routed requested live bytes and blocks, their process-wide requested-byte high water, component live blocks, Wasm linear-memory capacity, and process memory observations. The ledger handles failed reallocations and reports frees of previously unobserved pointers separately. It does not infer full native heap usage, allocator overhead, JS ownership, a stage peak, or a leak from capacity. Runtime allocations before the hook and allocator-internal work remain incompletely observed. Document and pack disposal are recorded, while process-lifetime language caches can remain until worker exit.

Result counters name actual captures, retained intervals, dropped interval classes, segments, paths, scope names, full source coverage, and segment density. Source coverage is not scanned bytes. Copy accounting includes the decoded segment slice and encoded JSON size only. Other copies remain unsupported. Source-view size and root-tree handle count describe the live owner; buffer allocation capacity and ownership-separated tree and cache bytes are unavailable.

The report explicitly marks incremental edits, invalidation, suffix movement, native theme switches, first viewport, simultaneous documents, injection work, downstream transport, rendering, overlays, LSP, and owned cache byte counts as unsupported. Existing mixed Markdown work is outside this root-only adapter. No absent observation is replaced with zero.

The catalog retains every public language row, structural language row, locked theme, and unavailable injection dependency from the pinned manifests. Only the selected root language is measured as a partial prototype. Four themes use the reference matcher; other themes and languages remain unmeasured. These rows are diagnostic accounting, not parity denominators or promotion decisions.

## Identity and evaluation gates

Reports include the Git head and status, a content hash over sorted tracked and nonignored untracked file bytes, input hashes and sizes, loaded parser and query identities, runtime and component hashes, component compiler and flags, observer artifact hash, Node versions, hardware, OS, warmups, repetitions, and observed process and leaf-cgroup limits. Runtime build flags are unavailable because only the component has a checked build manifest. Parent cgroup restrictions and host quietness are not inferred. The command fails if repository source content changes during its run.

Tiny command tests exercise real workers, all three languages, allocation controls, catalog accounting, parse counts, and equivalent full-document output. They assert correctness without timing budgets. Source, baseline, golden, and candidate-report files are read-only.

Current incremental-Shiki consumer controls and common-rendering attribution remain external prerequisites before release evaluation. Accepted 007 through 009 components, coverage decisions, independently selected numeric budgets, independent review, green Complete CI, and normal merge gates remain required for their respective later decisions. Landing this internal command does not satisfy those gates.
