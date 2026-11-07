# Frozen JavaScript and JSX source intake

The Plan 010 wave has 25 inputs, 21 development and four evaluation, in five reference profiles and 65 themes. It declares 8,125 theme rows and 125 scope requests before any results. Empty sources retain lifecycle requests with N/A semantic ratios. Every nonempty source retains its full UTF-16 length, including recovery and unsupported regions.

Run the offline intake from `test/highlight-compat`:

```sh
node scripts/intake-js-jsx.ts
npx vitest run tests/js-jsx-wave.test.ts
```

The intake reads fixture code as bytes, never as executable modules. It makes no network request, reference request, candidate run, comparison, acceptance decision, or promotion claim.

## Explicit membership

`manifest/waves/010-js-jsx-root.json` and `manifest/fixture-sources.010-js-jsx.json` retain the exact reviewed acquisition declarations. New assets live under `test/highlight-compat/fixtures/waves/010-js-jsx/`. Paths in the frozen packet are relative to that directory, except its wave manifest and fixture-sources additions, which map to the two manifest paths above. The seven reused development inputs retain their original paths and identities.

The historical fixture registry and `originalFixtures()` do not discover the wave. Existing golden producers, the frozen 007 experiment, and reference and historical report defaults keep their original corpus. The additions are a separate review-packet schema, not an append to the historical `FixtureManifest` schema. Source membership does not imply grammar expectations or a passing result.

`selection-lock.json` has SHA-256 `7ca8c0ca9fc2cc29445ecead260a906693fafe62c52a55c55f40f6103312d2bd`. The TypeScript intake verifies every retained locked asset and all 227 original preservation identities. The two Python acquisition-tool entries remain external evidence identities in that lock. Their code is not shipped or executed here. `scope-requests.tsv` is a theme-deduplicated projection of the unchanged `expected-rows.tsv`, checked against the full Cartesian product on every intake.

## Roles and unmet obligations

Evaluation sources, provenance patches, and any later evaluation output must not be sent to the experimental pack author. Keep them separate from development controls. Licenses, copyright notices, immutable source pins, and file ancestry remain with the packet. The four evaluation inputs represent two derivation families, not four independent origins.

The frozen acquisition manifest describes availability at acquisition time. It is not a current runtime capability probe or an updated result report. Its mandatory metadata requirement remains intact. Successful opt-in metadata behavior is proven only for JSON; required nonempty JavaScript and JSX metadata remains unsupported. Scope and style observations alone cannot satisfy combined acceptance. Missing, failed, canceled, incomplete, identity-invalid, missing-style, or missing-metadata observations are not successful rows.

This source-intake unit does not collect or copy expected output. Native packs, reference metadata integration, independent code review, publication ordering, hosted CI, merge, stateful acceptance, broader evaluation feature lanes, and promotion remain separate obligations.
