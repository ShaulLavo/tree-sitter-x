# Phase 1 harness gate

Status: passed for the pinned Phase 1 inputs. Native classification and production cutover remain separate gates.

| Plan Phase 1 item | Evidence | Outcome |
| --- | --- | --- |
| Isolated oracle adapters and canonical interval/schema validation | src/oracles/run.ts; tests/oracle-core.test.ts; tests/validate.test.ts; tests/build.test.ts | Fresh workers, hard deadline, complete tiling, canonical interning and failure diagnostics tested |
| Upstream oracle suites, initial VS Code/TypeScript fixtures, annotation adapters and Unicode/EOL cases | reports/fixtures.md; tests/oracle-conformance.test.ts; tests/fixture-adapters.test.ts; tests/original-fixtures.test.ts | 94 selected conformance cases per raw engine; named historical differences stay explicit; 16 runnable real fixtures and 28 original fixtures |
| Comparator self-tests for split/coalesced tokens, missing/reordered/extra scopes, default styles, empty input, clipping and failed references | tests/compare.test.ts; tests/categorize.test.ts; tests/sweep.test.ts; tests/memory.test.ts | Exact paths and named style fields checked independently of token boundaries |
| Read-only test mode and explicit reference-only golden updates | tests/golden.test.ts; tests/goldens.test.ts; src/golden-producers.ts; scripts/regenerate.ts | Candidate profiles refused; npm test reads committed goldens; regeneration checks temp trees |
| Diagnostic simple capture mapping and compatible VS Code query baselines | reports/baselines.md; tests/baselines.test.ts; tests/baseline-theme.test.ts | TypeScript and TSX run in both baselines; unsupported Markdown and excluded patterns accounted for |

## Required self-test counts

Regeneration runs these tests against the checkout before hashing either pipeline. Counts below come from Vitest’s JSON results. Every test case must pass. The full npm test suite is a separate CI step.

| Test file | Passed | Test cases |
| --- | ---: | ---: |
| tests/build.test.ts | 10 | 10 |
| tests/validate.test.ts | 76 | 76 |
| tests/serialize.test.ts | 6 | 6 |
| tests/compare.test.ts | 15 | 15 |
| tests/categorize.test.ts | 17 | 17 |
| tests/sweep.test.ts | 3 | 3 |
| tests/memory.test.ts | 1 | 1 |
| tests/streaming-source.test.ts | 2 | 2 |
| tests/golden.test.ts | 46 | 46 |
| tests/sparse-goldens.test.ts | 4 | 4 |
| tests/oracle-core.test.ts | 20 | 20 |
| tests/oracle-conformance.test.ts | 194 | 194 |
| tests/product-document.test.ts | 6 | 6 |
| tests/fixture-adapters.test.ts | 20 | 20 |
| tests/expectations.test.ts | 3 | 3 |
| tests/original-fixtures.test.ts | 30 | 30 |
| tests/baselines.test.ts | 12 | 12 |
| tests/baseline-theme.test.ts | 2 | 2 |
| tests/phase1-gate.test.ts | 3 | 3 |
| Total | 470 | 470 |

## Two full-pipeline runs

Each run regenerates every registered reference profile, the fixture report, reference differences, historical expectations and both baseline comparisons. Hashes cover sorted relative paths and exact bytes of all regenerated goldens and reports, except this hash-bearing gate record. After writing the identical gate record into both trees, the checker also compares their complete artifact trees byte-for-byte.

- Run 1 SHA-256: 0bf797ef71be00486bf7348d7ae8d105918ffd81a2d4d855107b249983239197
- Run 2 SHA-256: 0bf797ef71be00486bf7348d7ae8d105918ffd81a2d4d855107b249983239197

The checker then compares the entire regenerated tree with the committed tree. A changed, missing or extra report/golden fails. No timing, absolute path, runtime-dependent identity or timestamp enters this content hash.

## Reference differences and synthetic lane isolation

reports/reference-differences.md documents every named original-fixture and oracle-suite difference. Its generator fails on unexplained, ambiguous or unobserved expectations. The historical report measures grammar-revision drift separately and gates nothing.

Synthetic tokenizer-only grammars live under vendor/vscode-textmate and enter src/oracles/conformance.ts only. They do not enter src/fixtures/registry.ts, corpusInputs, baselineComparisons, or language goldens. tests/phase1-gate.test.ts checks that isolation. The 242-language catalog denominator never counts synthetic oracle grammars as native languages.

Reproduce with `npm run artifacts:check`. Refresh with `npm run artifacts:update`. Build lib/binding_web from this checkout first. Parser/query assets and Markdown 0.1.1 identities are pinned and byte-verified locally; no Platform access or network occurs during tests or regeneration.
