# Theme admission supplement, version 1

This independent supplement is not an extension or rewrite of `native-themes/`.
It changes no candidate source, language fixture, frozen wave, or old expectation.

From `test/highlight-compat` with locked dependencies installed:

```sh
npm run oracle:theme-admission:update
npm run oracle:theme-admission:check
npx vitest run tests/native-theme-admission.test.ts
```

Only explicit `--update` writes `suite.json`. The default test configuration includes
the new reference-only tests. `--check` makes all actual target calls again and
compares exact deterministic bytes. Neither command runs a candidate normalizer,
packet builder, matcher, collector, language wave or scorer.

## Two authorities

`input.contract` and `transport` are authored expectations under the November 8,
2026 parent amendment of design 010. They are not TextMate/Shiki diagnostics.
`attempts[].result` contains actual pinned target output or an unrepaired target
error with its stage, name and message. No rule identity is inferred from matching.
Original source arrays and original resource-local diagnostic ordinals remain in
`input`; normalized arrays retain target-generated defaults and their actual order.
Only the selected `settings ?? tokenColors` stream contributes native selectors and
rule budgets. Both original arrays still require schema/property validation.

Each input retains exact UTF-8 JSON bytes, per-resource hashes, the authorized
include edges, explicit base-first order, a separately authored expansion, synthetic
scope matrices, admission/warning controls, and whether Shiki API controls run.
Included expansions are checked against selected source streams. A changed base
byte has a different acquisition identity even if every observed style is equal.
No resource is fetched implicitly.

## Reference calls and projection

For each profile, full input runs through the checked-in raw reference adapter or
the product registration adapter and pinned Shiki normalizer. Raw observations are
checked with actual upstream and fork packed tokenization. Every nonempty stack
also runs through the actual product scoped tokenizer. Selected positive cases run
through Shiki's highlighter API too. All direct calls use synthetic grammars only.
Named effective fields and partial-presence traces come from the pinned fork Theme;
upstream match records are retained separately, including its actual font metrics.
Raw applies background; product and Shiki API apply foreground and font style only.
The upstream's exposed fontFamily/fontSize/lineHeight are outside this projection,
not universally ignored. Unknown properties and unsupported selectors stay authored
contract failures even when reference calls complete successfully.

Validated untouched UI inputs run full and typed-projection views separately for
raw and product, with and without explicit global defaults. Compare selected
styles, partials, direct outputs, normalized syntax and effective default fields.
Do not require deliberately different UI color bags to be equal. Projection never
removes editor.foreground/background or any terminal.ansi-prefixed value. Consumed
negative controls retain target normalization failures, including unknown ANSI
suffixes. Invalid shapes are not projected to make targets succeed.

## Identities and integrity

SHA-256 identities use a distinct `admission/*/v1` domain, a NUL separator and the
exact deterministic JSON of the named body. These are supplement identities, not
native production acquisition/content/packet revisions. `source.commit` is the
immutable target-source pin. `source.inputs` hashes the transitive reference source
graph, including type imports. Tests reject candidate/native/collector imports.
`targets` records upstream/fork versions and bundles, product adapter/profile,
package lock, normalizer, engine and both reference Wasm delivery identities.

The loader validates schema, hashes, exact source bytes, authorized closure,
authored expansion, named field formats, partials, array-qualified warnings and
complete suite identity. Tests run direct extraction and deterministic regeneration,
UI projection controls, a consumed-key deletion mutation, source-byte/pointer/trace
corruption controls, and preserved legacy warning shapes. Authored complete/failed
reply and retained-request-readback expectations are data for later implementation
tests. This reference-only unit does not execute or claim to fix that transport.

The existing 22-fixture/236-style-case suite and separate 83 authored diagnostics
remain byte-identical. Later admission/source/native/CI tests and review are separate
gates. No outcome here establishes catalog parity, selector admission or launch.
