# Collect the frozen JavaScript and JSX wave

Build the existing runtime, scope component and web binding, then install the harness dependencies from their frozen lockfiles:

```sh
cargo xtask build-wasm
cargo xtask build-scope-compat
npm --prefix lib/binding_web ci
npm --prefix lib/binding_web run build:ts
npm --prefix test/highlight-compat ci
```

Commit and freeze the implementation before collecting. The command rejects dirty implementation files, changed frozen packs and changed installed theme assets. It requires an explicit partition, retained reference directory and new or empty output directory:

```sh
npm --prefix test/highlight-compat run collect:wave -- \
  --split development --references /work/retained/development --out /work/collection/development
```

The implementation author uses only development sources and references. An independent evaluator runs the same frozen command with `--split evaluation` and its separate reference and output directories. Neither partition command reads the other partition's source or provenance payloads. Global declaration validation still covers 125 scope requests and 8,125 theme rows. Development contains 105 requests and 6,825 theme rows. Evaluation contains 20 requests and 1,300 theme rows.

Each fixture and profile gets one finite worker, one owner, one scope generation and 65 sequential native theme selections. There are no fixture, profile, theme, retry or reference-recollection options. Each worker has a 60,000 ms process deadline and a 1,000 ms exit grace. Replies are provisional until clean exit. Files, replies and gzip expansion are bounded to 64 MiB.

The output includes an initial and final execution ledger, compressed original raw-full and presented schema-1 documents, per-theme terminal outcomes, `scope-rows.json`, `theme-rows.tsv` and `REPORT.md`. Files are replaced atomically. Returned theme failures leave successful scopes and unrelated styles available. Process failures discard the entire uncommitted request. Interrupts preserve canceled and later unrun rows.

Recheck retained files against the same frozen checkout and built runtime/component identities without creating workers, opening native owners or calling a reference engine:

```sh
npm --prefix test/highlight-compat run collect:wave -- \
  --split development --references /work/retained/development --out /work/collection/development --check
```

Rechecking does not rewrite documents or reports. Changed identities, documents, rows or report contents fail integrity checks. An unfinished initial ledger cannot become a successful collection.

Exit codes are 0 for operational completion and exact mandatory tracks, 1 for reported semantic or coverage failures, 2 for usage errors and 3 for integrity errors. SIGINT and SIGTERM exit 130 and 143. Nonempty JavaScript and JSX metadata remains unavailable, so this wave cannot exit 0. Empty ratios are N/A, not successful semantic measurements. Six retained development reference timeouts remain missing truth.

Raw and raw-fork requests use native raw normalization and identity framing. Shiki API uses product normalization and identity framing. Product and warm-product requests use product normalization and the existing product-line projection. The Shiki API line cutoff has no equivalent native projection here. Warm and cold labels identify reference profiles, not native timing states.

The harness maps actual native foreground and font flags to its resolved-style convention, without background or a zero-font reset. Only comparison views canonicalize opaque RGBA to RGB, symmetrically on both sides. Original documents and presentation digests remain unchanged. Scope denominators count each request once, while theme denominators count styles separately. Reports distinguish coverage, conditional agreement, fixed-denominator agreement and unobserved units.

This command makes no performance, promotion or cutover claim. Full collection, independent review and release gates remain separate work.
