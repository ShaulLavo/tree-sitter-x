# Diagnostic capture baselines

These are candidate profiles, never goldens. Scope names, ancestor paths, ordering and punctuation are scored by the unchanged harness comparator. Styles use the pinned TextMate Theme matcher with each reference’s own theme normalization. Feeding reference scopes through that matcher is independently checked against direct reference styles in tests/baseline-theme.test.ts.

Coverage denominators: 242 product catalog languages, 23 structural languages, 5 pinned pilot parser variants; 16 real source fixtures and 28 original adversarial fixtures. 144/176 baseline × reference × fixture comparisons complete. Unsupported cases never enter agreement denominators. Per-theme denominators are shown in UTF-16 units. Empty denominators are N/A.

Real and original corpora are scored separately so the long-line cap fixtures cannot hide small real-file failures. All-text and non-whitespace metrics are length weighted. File macro averages give each comparable nonempty file equal weight. Metadata is N/A because raw and product expose no metadata track. Background is outside both reference token-style contracts. Styles distinguish absent fields and explicit resets without changing comparator rules.

## Composition and scope mapping

baseline:captures uses capture-map-1 in src/baselines/capture-map.ts. baseline:vscode-ts uses the capture names verbatim from VS Code f39c7109bf651845855cbef5af2e91b2c9bd0a74. Both parse with lib/binding_web built from this checkout, not an npm runtime. Vendored parser and query bytes are tested against manifest/tree-sitter-languages.json; the VS Code query hash is pinned separately.

Composition sweeps capture endpoints. The root scope comes first. Active captures sort by start ascending, end descending (enclosing first), accepted query-pattern index ascending, declared capture-name ordinal ascending, then code-point capture name. Query match enumeration never decides a tie. Coincident captures and duplicates are retained. Crossing intervals use the same order. Every LF or CRLF terminator has an empty path and empty style; a lone CR remains text. Transparent embedded captures add no scope. These baselines use the outer parser tree only. Injections and local-variable analysis are not implemented.

## Query compatibility and operation inventory

The web binding evaluates eq?, not-eq?, match? and their quantified variants, plus any-of? and not-any-of?. Text predicates use the binding’s JavaScript regex dialect. Any unknown predicate or directive throws. No selected query uses a directive. #is-not? local is returned as metadata by the binding, not evaluated. Every affected pattern is explicitly excluded below; these query remainders are partial diagnostic baselines.

### baseline:captures / javascript

Accepted 35/37 patterns. Operations: eq?, is-not?, match?.

- pattern 14 at query line 61: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them
- pattern 15 at query line 65: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them

### baseline:captures / typescript

Accepted 41/43 patterns. Operations: eq?, is-not?, match?.

- pattern 27 at query line 127: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them
- pattern 28 at query line 131: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them

### baseline:captures / tsx

Accepted 48/50 patterns. Operations: eq?, is-not?, match?.

- pattern 27 at query line 127: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them
- pattern 28 at query line 131: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them

### baseline:captures / json

Accepted 6/6 patterns. Operations: none.

No excluded patterns.

### baseline:vscode-ts / typescript

Accepted 110/110 patterns. Operations: eq?, match?, not-eq?.

No excluded patterns.

### baseline:vscode-ts / tsx

Accepted 110/110 patterns. Operations: eq?, match?, not-eq?.

No excluded patterns.

## Exact scope-path agreement

| Baseline | Reference | Corpus | Language | Compared / inputs | Scope all | Scope non-whitespace | File macro | Matching / comparable UTF-16 |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline:captures | raw | real | javascript | 7/7 | 5.21% | 0.00% | 6.19% | 380/7297 |
| baseline:captures | product | real | javascript | 7/7 | 5.21% | 0.00% | 6.19% | 380/7297 |
| baseline:captures | raw | real | typescript | 7/7 | 8.40% | 0.00% | 7.04% | 499/5944 |
| baseline:captures | product | real | typescript | 7/7 | 8.40% | 0.00% | 7.04% | 499/5944 |
| baseline:captures | raw | real | tsx | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 |
| baseline:captures | product | real | tsx | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 |
| baseline:captures | raw | real | json | 1/1 | 5.83% | 0.00% | 5.83% | 13/223 |
| baseline:captures | product | real | json | 1/1 | 5.83% | 0.00% | 5.83% | 13/223 |
| baseline:captures | raw | original | json | 6/6 | 0.06% | 0.00% | 14.51% | 13/20055 |
| baseline:captures | product | original | json | 6/6 | 0.06% | 0.00% | 14.51% | 13/20055 |
| baseline:captures | raw | original | markdown | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:captures | product | original | markdown | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:captures | raw | original | tsx | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 |
| baseline:captures | product | original | tsx | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 |
| baseline:captures | raw | original | typescript | 17/17 | 0.06% | 0.00% | 15.10% | 46/80315 |
| baseline:captures | product | original | typescript | 17/17 | 0.05% | 0.00% | 8.02% | 43/80315 |
| baseline:vscode-ts | raw | real | javascript | 0/7 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | product | real | javascript | 0/7 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | raw | real | typescript | 7/7 | 8.87% | 0.63% | 7.20% | 527/5944 |
| baseline:vscode-ts | product | real | typescript | 7/7 | 8.87% | 0.63% | 7.20% | 527/5944 |
| baseline:vscode-ts | raw | real | tsx | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 |
| baseline:vscode-ts | product | real | tsx | 1/1 | 5.71% | 0.00% | 5.71% | 8/140 |
| baseline:vscode-ts | raw | real | json | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | product | real | json | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | raw | original | json | 0/6 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | product | original | json | 0/6 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | raw | original | markdown | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | product | original | markdown | 0/1 | N/A | N/A | N/A | 0/0 |
| baseline:vscode-ts | raw | original | tsx | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 |
| baseline:vscode-ts | product | original | tsx | 4/4 | 0.07% | 0.00% | 10.26% | 15/20120 |
| baseline:vscode-ts | raw | original | typescript | 17/17 | 0.06% | 0.00% | 15.10% | 46/80315 |
| baseline:vscode-ts | product | original | typescript | 17/17 | 0.05% | 0.00% | 8.02% | 43/80315 |

## Style agreement by theme

| Baseline | Reference | Corpus | Language | Theme | Compared | Style all | Style non-whitespace | File macro | Matching / comparable UTF-16 | Foreground mismatch | Font-style mismatch |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline:captures | raw | real | javascript | github-dark | 7 | 94.82% | 93.25% | 97.19% | 6919/7297 | 378 | 0 |
| baseline:captures | raw | real | javascript | light-plus | 7 | 94.26% | 92.52% | 96.72% | 6878/7297 | 419 | 0 |
| baseline:captures | raw | real | javascript | dracula | 7 | 94.34% | 92.63% | 96.00% | 6884/7297 | 400 | 225 |
| baseline:captures | raw | real | javascript | vesper | 7 | 96.81% | 95.84% | 97.96% | 7064/7297 | 233 | 0 |
| baseline:captures | product | real | javascript | github-dark | 7 | 94.82% | 93.25% | 97.19% | 6919/7297 | 378 | 0 |
| baseline:captures | product | real | javascript | light-plus | 7 | 94.26% | 92.52% | 96.72% | 6878/7297 | 419 | 0 |
| baseline:captures | product | real | javascript | dracula | 7 | 94.34% | 92.63% | 96.00% | 6884/7297 | 400 | 225 |
| baseline:captures | product | real | javascript | vesper | 7 | 96.81% | 95.84% | 97.96% | 7064/7297 | 233 | 0 |
| baseline:captures | raw | real | typescript | github-dark | 7 | 87.74% | 84.46% | 88.09% | 5215/5944 | 729 | 0 |
| baseline:captures | raw | real | typescript | light-plus | 7 | 79.76% | 73.84% | 79.77% | 4741/5944 | 1203 | 0 |
| baseline:captures | raw | real | typescript | dracula | 7 | 88.19% | 85.06% | 83.19% | 5242/5944 | 670 | 90 |
| baseline:captures | raw | real | typescript | vesper | 7 | 91.05% | 88.87% | 90.00% | 5412/5944 | 532 | 0 |
| baseline:captures | product | real | typescript | github-dark | 7 | 87.74% | 84.46% | 88.09% | 5215/5944 | 729 | 0 |
| baseline:captures | product | real | typescript | light-plus | 7 | 79.76% | 73.84% | 79.77% | 4741/5944 | 1203 | 0 |
| baseline:captures | product | real | typescript | dracula | 7 | 88.19% | 85.06% | 83.19% | 5242/5944 | 670 | 90 |
| baseline:captures | product | real | typescript | vesper | 7 | 91.05% | 88.87% | 90.00% | 5412/5944 | 532 | 0 |
| baseline:captures | raw | real | tsx | github-dark | 1 | 95.71% | 94.74% | 95.71% | 134/140 | 6 | 0 |
| baseline:captures | raw | real | tsx | light-plus | 1 | 96.43% | 95.61% | 96.43% | 135/140 | 5 | 0 |
| baseline:captures | raw | real | tsx | dracula | 1 | 91.43% | 89.47% | 91.43% | 128/140 | 12 | 5 |
| baseline:captures | raw | real | tsx | vesper | 1 | 96.43% | 95.61% | 96.43% | 135/140 | 5 | 0 |
| baseline:captures | product | real | tsx | github-dark | 1 | 95.71% | 94.74% | 95.71% | 134/140 | 6 | 0 |
| baseline:captures | product | real | tsx | light-plus | 1 | 96.43% | 95.61% | 96.43% | 135/140 | 5 | 0 |
| baseline:captures | product | real | tsx | dracula | 1 | 91.43% | 89.47% | 91.43% | 128/140 | 12 | 5 |
| baseline:captures | product | real | tsx | vesper | 1 | 96.43% | 95.61% | 96.43% | 135/140 | 5 | 0 |
| baseline:captures | raw | real | json | github-dark | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | raw | real | json | light-plus | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | raw | real | json | dracula | 1 | 55.61% | 41.76% | 55.61% | 124/223 | 99 | 0 |
| baseline:captures | raw | real | json | vesper | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | product | real | json | github-dark | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | product | real | json | light-plus | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | product | real | json | dracula | 1 | 55.61% | 41.76% | 55.61% | 124/223 | 99 | 0 |
| baseline:captures | product | real | json | vesper | 1 | 62.33% | 50.59% | 62.33% | 139/223 | 84 | 0 |
| baseline:captures | raw | original | json | github-dark | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | raw | original | json | light-plus | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | raw | original | json | dracula | 5 | 99.91% | 99.91% | 84.32% | 20037/20055 | 18 | 0 |
| baseline:captures | raw | original | json | vesper | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | product | original | json | github-dark | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | product | original | json | light-plus | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | product | original | json | dracula | 5 | 99.91% | 99.91% | 84.32% | 20037/20055 | 18 | 0 |
| baseline:captures | product | original | json | vesper | 5 | 99.94% | 99.94% | 88.24% | 20043/20055 | 12 | 0 |
| baseline:captures | raw | original | markdown | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | raw | original | markdown | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | raw | original | markdown | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | raw | original | markdown | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | product | original | markdown | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | product | original | markdown | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | product | original | markdown | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | product | original | markdown | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:captures | raw | original | tsx | github-dark | 4 | 99.92% | 99.92% | 90.71% | 20104/20120 | 16 | 0 |
| baseline:captures | raw | original | tsx | light-plus | 4 | 99.87% | 99.87% | 84.81% | 20094/20120 | 26 | 0 |
| baseline:captures | raw | original | tsx | dracula | 4 | 99.93% | 99.93% | 90.94% | 20105/20120 | 15 | 0 |
| baseline:captures | raw | original | tsx | vesper | 4 | 99.95% | 99.95% | 93.48% | 20109/20120 | 11 | 0 |
| baseline:captures | product | original | tsx | github-dark | 4 | 99.92% | 99.92% | 90.71% | 20104/20120 | 16 | 0 |
| baseline:captures | product | original | tsx | light-plus | 4 | 99.87% | 99.87% | 84.81% | 20094/20120 | 26 | 0 |
| baseline:captures | product | original | tsx | dracula | 4 | 99.93% | 99.93% | 90.94% | 20105/20120 | 15 | 0 |
| baseline:captures | product | original | tsx | vesper | 4 | 99.95% | 99.95% | 93.48% | 20109/20120 | 11 | 0 |
| baseline:captures | raw | original | typescript | github-dark | 16 | 99.99% | 99.99% | 97.14% | 80305/80315 | 10 | 0 |
| baseline:captures | raw | original | typescript | light-plus | 16 | 99.98% | 99.98% | 96.57% | 80302/80315 | 13 | 0 |
| baseline:captures | raw | original | typescript | dracula | 16 | 99.99% | 99.99% | 98.38% | 80306/80315 | 9 | 0 |
| baseline:captures | raw | original | typescript | vesper | 16 | 100.00% | 100.00% | 100.00% | 80315/80315 | 0 | 0 |
| baseline:captures | product | original | typescript | github-dark | 16 | 50.17% | 50.10% | 77.47% | 40291/80315 | 40024 | 0 |
| baseline:captures | product | original | typescript | light-plus | 16 | 50.16% | 50.09% | 76.90% | 40288/80315 | 40027 | 0 |
| baseline:captures | product | original | typescript | dracula | 16 | 50.17% | 50.10% | 78.71% | 40292/80315 | 40023 | 0 |
| baseline:captures | product | original | typescript | vesper | 16 | 50.18% | 50.11% | 80.33% | 40301/80315 | 40014 | 0 |
| baseline:vscode-ts | raw | real | javascript | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | javascript | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | javascript | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | javascript | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | javascript | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | javascript | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | javascript | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | javascript | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | typescript | github-dark | 7 | 88.44% | 85.40% | 87.00% | 5257/5944 | 687 | 0 |
| baseline:vscode-ts | raw | real | typescript | light-plus | 7 | 84.94% | 80.74% | 88.18% | 5049/5944 | 895 | 0 |
| baseline:vscode-ts | raw | real | typescript | dracula | 7 | 92.26% | 90.48% | 90.42% | 5484/5944 | 459 | 40 |
| baseline:vscode-ts | raw | real | typescript | vesper | 7 | 93.32% | 91.89% | 92.11% | 5547/5944 | 397 | 0 |
| baseline:vscode-ts | product | real | typescript | github-dark | 7 | 88.44% | 85.40% | 87.00% | 5257/5944 | 687 | 0 |
| baseline:vscode-ts | product | real | typescript | light-plus | 7 | 84.94% | 80.74% | 88.18% | 5049/5944 | 895 | 0 |
| baseline:vscode-ts | product | real | typescript | dracula | 7 | 92.26% | 90.48% | 90.42% | 5484/5944 | 459 | 40 |
| baseline:vscode-ts | product | real | typescript | vesper | 7 | 93.32% | 91.89% | 92.11% | 5547/5944 | 397 | 0 |
| baseline:vscode-ts | raw | real | tsx | github-dark | 1 | 98.57% | 98.25% | 98.57% | 138/140 | 2 | 0 |
| baseline:vscode-ts | raw | real | tsx | light-plus | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | raw | real | tsx | dracula | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | raw | real | tsx | vesper | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | product | real | tsx | github-dark | 1 | 98.57% | 98.25% | 98.57% | 138/140 | 2 | 0 |
| baseline:vscode-ts | product | real | tsx | light-plus | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | product | real | tsx | dracula | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | product | real | tsx | vesper | 1 | 100.00% | 100.00% | 100.00% | 140/140 | 0 | 0 |
| baseline:vscode-ts | raw | real | json | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | json | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | json | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | real | json | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | json | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | json | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | json | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | real | json | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | json | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | json | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | json | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | json | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | json | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | json | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | json | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | json | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | markdown | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | markdown | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | markdown | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | markdown | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | markdown | github-dark | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | markdown | light-plus | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | markdown | dracula | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | product | original | markdown | vesper | 0 | N/A | N/A | N/A | 0/0 | 0 | 0 |
| baseline:vscode-ts | raw | original | tsx | github-dark | 4 | 99.89% | 99.89% | 86.23% | 20098/20120 | 22 | 0 |
| baseline:vscode-ts | raw | original | tsx | light-plus | 4 | 99.79% | 99.79% | 73.99% | 20077/20120 | 43 | 0 |
| baseline:vscode-ts | raw | original | tsx | dracula | 4 | 99.91% | 99.91% | 88.55% | 20102/20120 | 18 | 5 |
| baseline:vscode-ts | raw | original | tsx | vesper | 4 | 99.80% | 99.80% | 75.69% | 20080/20120 | 40 | 0 |
| baseline:vscode-ts | product | original | tsx | github-dark | 4 | 99.89% | 99.89% | 86.23% | 20098/20120 | 22 | 0 |
| baseline:vscode-ts | product | original | tsx | light-plus | 4 | 99.79% | 99.79% | 73.99% | 20077/20120 | 43 | 0 |
| baseline:vscode-ts | product | original | tsx | dracula | 4 | 99.91% | 99.91% | 88.55% | 20102/20120 | 18 | 5 |
| baseline:vscode-ts | product | original | tsx | vesper | 4 | 99.80% | 99.80% | 75.69% | 20080/20120 | 40 | 0 |
| baseline:vscode-ts | raw | original | typescript | github-dark | 16 | 99.96% | 99.96% | 93.32% | 80285/80315 | 30 | 0 |
| baseline:vscode-ts | raw | original | typescript | light-plus | 16 | 99.99% | 99.99% | 97.14% | 80305/80315 | 10 | 0 |
| baseline:vscode-ts | raw | original | typescript | dracula | 16 | 100.00% | 100.00% | 100.00% | 80315/80315 | 0 | 0 |
| baseline:vscode-ts | raw | original | typescript | vesper | 16 | 100.00% | 100.00% | 100.00% | 80315/80315 | 0 | 0 |
| baseline:vscode-ts | product | original | typescript | github-dark | 16 | 50.14% | 50.07% | 73.66% | 40272/80315 | 40043 | 0 |
| baseline:vscode-ts | product | original | typescript | light-plus | 16 | 50.17% | 50.10% | 77.47% | 40291/80315 | 40024 | 0 |
| baseline:vscode-ts | product | original | typescript | dracula | 16 | 50.18% | 50.11% | 80.33% | 40301/80315 | 40014 | 0 |
| baseline:vscode-ts | product | original | typescript | vesper | 16 | 50.18% | 50.11% | 80.33% | 40301/80315 | 40014 | 0 |

## Scope mismatch categories

| Baseline | Reference | Corpus | Language | Category | Runs | UTF-16 units |
| --- | --- | --- | --- | --- | ---: | ---: |
| baseline:captures | raw | real | javascript | leaf | 287 | 2456 |
| baseline:captures | raw | real | javascript | missing-scope | 396 | 514 |
| baseline:captures | raw | real | javascript | other | 1083 | 3947 |
| baseline:captures | product | real | javascript | leaf | 287 | 2456 |
| baseline:captures | product | real | javascript | missing-scope | 396 | 514 |
| baseline:captures | product | real | javascript | other | 1083 | 3947 |
| baseline:captures | raw | real | typescript | leaf | 254 | 1369 |
| baseline:captures | raw | real | typescript | missing-scope | 783 | 1284 |
| baseline:captures | raw | real | typescript | extra-scope | 4 | 4 |
| baseline:captures | raw | real | typescript | other | 1124 | 2788 |
| baseline:captures | product | real | typescript | leaf | 254 | 1369 |
| baseline:captures | product | real | typescript | missing-scope | 783 | 1284 |
| baseline:captures | product | real | typescript | extra-scope | 4 | 4 |
| baseline:captures | product | real | typescript | other | 1124 | 2788 |
| baseline:captures | raw | real | tsx | leaf | 3 | 20 |
| baseline:captures | raw | real | tsx | missing-scope | 11 | 13 |
| baseline:captures | raw | real | tsx | other | 25 | 99 |
| baseline:captures | product | real | tsx | leaf | 3 | 20 |
| baseline:captures | product | real | tsx | missing-scope | 11 | 13 |
| baseline:captures | product | real | tsx | other | 25 | 99 |
| baseline:captures | raw | real | json | missing-scope | 60 | 70 |
| baseline:captures | raw | real | json | other | 47 | 140 |
| baseline:captures | product | real | json | missing-scope | 60 | 70 |
| baseline:captures | product | real | json | other | 47 | 140 |
| baseline:captures | raw | original | json | missing-scope | 26 | 28 |
| baseline:captures | raw | original | json | other | 21 | 20014 |
| baseline:captures | product | original | json | missing-scope | 26 | 28 |
| baseline:captures | product | original | json | other | 21 | 20014 |
| baseline:captures | raw | original | tsx | leaf | 1 | 19998 |
| baseline:captures | raw | original | tsx | missing-scope | 19 | 30 |
| baseline:captures | raw | original | tsx | other | 47 | 77 |
| baseline:captures | product | original | tsx | leaf | 1 | 19998 |
| baseline:captures | product | original | tsx | missing-scope | 19 | 30 |
| baseline:captures | product | original | tsx | other | 47 | 77 |
| baseline:captures | raw | original | typescript | leaf | 7 | 80009 |
| baseline:captures | raw | original | typescript | missing-scope | 72 | 72 |
| baseline:captures | raw | original | typescript | other | 109 | 188 |
| baseline:captures | product | original | typescript | leaf | 8 | 40016 |
| baseline:captures | product | original | typescript | missing-scope | 71 | 72 |
| baseline:captures | product | original | typescript | extra-scope | 5 | 40005 |
| baseline:captures | product | original | typescript | other | 104 | 179 |
| baseline:vscode-ts | raw | real | typescript | leaf | 232 | 1343 |
| baseline:vscode-ts | raw | real | typescript | missing-scope | 939 | 1792 |
| baseline:vscode-ts | raw | real | typescript | extra-scope | 4 | 4 |
| baseline:vscode-ts | raw | real | typescript | ancestor | 149 | 461 |
| baseline:vscode-ts | raw | real | typescript | other | 817 | 1817 |
| baseline:vscode-ts | product | real | typescript | leaf | 232 | 1343 |
| baseline:vscode-ts | product | real | typescript | missing-scope | 939 | 1792 |
| baseline:vscode-ts | product | real | typescript | extra-scope | 4 | 4 |
| baseline:vscode-ts | product | real | typescript | ancestor | 149 | 461 |
| baseline:vscode-ts | product | real | typescript | other | 817 | 1817 |
| baseline:vscode-ts | raw | real | tsx | leaf | 3 | 20 |
| baseline:vscode-ts | raw | real | tsx | missing-scope | 10 | 12 |
| baseline:vscode-ts | raw | real | tsx | other | 26 | 100 |
| baseline:vscode-ts | product | real | tsx | leaf | 3 | 20 |
| baseline:vscode-ts | product | real | tsx | missing-scope | 10 | 12 |
| baseline:vscode-ts | product | real | tsx | other | 26 | 100 |
| baseline:vscode-ts | raw | original | tsx | leaf | 1 | 19998 |
| baseline:vscode-ts | raw | original | tsx | missing-scope | 35 | 50 |
| baseline:vscode-ts | raw | original | tsx | other | 31 | 57 |
| baseline:vscode-ts | product | original | tsx | leaf | 1 | 19998 |
| baseline:vscode-ts | product | original | tsx | missing-scope | 35 | 50 |
| baseline:vscode-ts | product | original | tsx | other | 31 | 57 |
| baseline:vscode-ts | raw | original | typescript | leaf | 7 | 80009 |
| baseline:vscode-ts | raw | original | typescript | missing-scope | 128 | 195 |
| baseline:vscode-ts | raw | original | typescript | ancestor | 1 | 1 |
| baseline:vscode-ts | raw | original | typescript | other | 52 | 64 |
| baseline:vscode-ts | product | original | typescript | leaf | 8 | 40016 |
| baseline:vscode-ts | product | original | typescript | missing-scope | 125 | 191 |
| baseline:vscode-ts | product | original | typescript | extra-scope | 5 | 40005 |
| baseline:vscode-ts | product | original | typescript | ancestor | 1 | 1 |
| baseline:vscode-ts | product | original | typescript | other | 49 | 59 |

## Longest scope mismatch runs

| Baseline | Reference | Fixture | Range | Category | Reference path | Candidate path |
| --- | --- | --- | --- | --- | --- | --- |
| baseline:captures | product | original/line-20001 | [0, 20001) | extra-scope |  | source.ts comment |
| baseline:captures | product | original/line-20001-closes-open-comment | [3, 20004) | extra-scope |  | source.ts comment |
| baseline:vscode-ts | product | original/line-20001 | [0, 20001) | extra-scope |  | source.ts comment.ts |
| baseline:vscode-ts | product | original/line-20001-closes-open-comment | [3, 20004) | extra-scope |  | source.ts comment.ts |
| baseline:captures | raw | original/line-20001 | [2, 20001) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:captures | raw | original/line-20001-closes-open-comment | [3, 20002) | leaf | source.ts comment.block.ts | source.ts comment |
| baseline:vscode-ts | raw | original/line-20001 | [2, 20001) | leaf | source.ts comment.line.double-slash.ts | source.ts comment.ts |
| baseline:vscode-ts | raw | original/line-20001-closes-open-comment | [3, 20002) | leaf | source.ts comment.block.ts | source.ts comment.ts |
| baseline:captures | product | original/line-20000 | [2, 20000) | leaf | source.tsx comment.line.double-slash.tsx | source.tsx comment |
| baseline:captures | product | original/line-20000 | [2, 20000) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:captures | raw | original/line-20000 | [2, 20000) | leaf | source.tsx comment.line.double-slash.tsx | source.tsx comment |
| baseline:captures | raw | original/line-20000 | [2, 20000) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:vscode-ts | product | original/line-20000 | [2, 20000) | leaf | source.tsx comment.line.double-slash.tsx | source.tsx comment.ts |
| baseline:vscode-ts | product | original/line-20000 | [2, 20000) | leaf | source.ts comment.line.double-slash.ts | source.ts comment.ts |
| baseline:vscode-ts | raw | original/line-20000 | [2, 20000) | leaf | source.tsx comment.line.double-slash.tsx | source.tsx comment.ts |
| baseline:vscode-ts | raw | original/line-20000 | [2, 20000) | leaf | source.ts comment.line.double-slash.ts | source.ts comment.ts |
| baseline:captures | product | original/line-19999 | [2, 19999) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:captures | raw | original/line-19999 | [2, 19999) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:vscode-ts | product | original/line-19999 | [2, 19999) | leaf | source.ts comment.line.double-slash.ts | source.ts comment.ts |
| baseline:vscode-ts | raw | original/line-19999 | [2, 19999) | leaf | source.ts comment.line.double-slash.ts | source.ts comment.ts |
| baseline:captures | product | original/line-20000 | [7, 19998) | other | source.json meta.structure.dictionary.json meta.structure.dictionary.value.json string.quoted.double.json | source.json string.quoted |
| baseline:captures | raw | original/line-20000 | [7, 19998) | other | source.json meta.structure.dictionary.json meta.structure.dictionary.value.json string.quoted.double.json | source.json string.quoted |
| baseline:captures | product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [158, 254) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [158, 254) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [255, 349) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [255, 349) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [2, 95) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | [2, 95) | leaf | source.js comment.block.js | source.js comment |
| baseline:captures | product | typescript-tmlanguage/tests/cases/constTypeParameter.ts | [2, 76) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |
| baseline:captures | raw | typescript-tmlanguage/tests/cases/constTypeParameter.ts | [2, 76) | leaf | source.ts comment.line.double-slash.ts | source.ts comment |

## Unsupported and failed cases

- baseline:captures / markdown: pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured
- baseline:vscode-ts / javascript: VS Code TypeScript query applies only to the TypeScript and TSX variants
- baseline:vscode-ts / json: VS Code TypeScript query applies only to the TypeScript and TSX variants
- baseline:vscode-ts / markdown: VS Code TypeScript query applies only to the TypeScript and TSX variants

Non-complete case count is 32. The table below accounts for each fixture and reference.

| Baseline | Reference | Fixture | Outcome |
| --- | --- | --- | --- |
| baseline:captures | raw | original/fences | candidate status is unsupported |
| baseline:captures | product | original/fences | candidate status is unsupported |
| baseline:vscode-ts | raw | textmate-grammars-themes/samples/javascript.sample | candidate status is unsupported |
| baseline:vscode-ts | product | textmate-grammars-themes/samples/javascript.sample | candidate status is unsupported |
| baseline:vscode-ts | raw | tree-sitter-highlight/test/highlight/functions.js | candidate status is unsupported |
| baseline:vscode-ts | product | tree-sitter-highlight/test/highlight/functions.js | candidate status is unsupported |
| baseline:vscode-ts | raw | tree-sitter-highlight/test/highlight/imports.js | candidate status is unsupported |
| baseline:vscode-ts | product | tree-sitter-highlight/test/highlight/imports.js | candidate status is unsupported |
| baseline:vscode-ts | raw | tree-sitter-highlight/test/highlight/injection.js | candidate status is unsupported |
| baseline:vscode-ts | product | tree-sitter-highlight/test/highlight/injection.js | candidate status is unsupported |
| baseline:vscode-ts | raw | tree-sitter-highlight/test/highlight/keywords.js | candidate status is unsupported |
| baseline:vscode-ts | product | tree-sitter-highlight/test/highlight/keywords.js | candidate status is unsupported |
| baseline:vscode-ts | raw | tree-sitter-highlight/test/highlight/variables.js | candidate status is unsupported |
| baseline:vscode-ts | product | tree-sitter-highlight/test/highlight/variables.js | candidate status is unsupported |
| baseline:vscode-ts | raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | candidate status is unsupported |
| baseline:vscode-ts | product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.js | candidate status is unsupported |
| baseline:vscode-ts | raw | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | candidate status is unsupported |
| baseline:vscode-ts | product | vscode-colorize/extensions/vscode-colorize-tests/test/colorize-fixtures/test.json | candidate status is unsupported |
| baseline:vscode-ts | raw | original/bom | candidate status is unsupported |
| baseline:vscode-ts | product | original/bom | candidate status is unsupported |
| baseline:vscode-ts | raw | original/crlf | candidate status is unsupported |
| baseline:vscode-ts | product | original/crlf | candidate status is unsupported |
| baseline:vscode-ts | raw | original/empty-line-object | candidate status is unsupported |
| baseline:vscode-ts | product | original/empty-line-object | candidate status is unsupported |
| baseline:vscode-ts | raw | original/empty | candidate status is unsupported |
| baseline:vscode-ts | product | original/empty | candidate status is unsupported |
| baseline:vscode-ts | raw | original/line-20000 | candidate status is unsupported |
| baseline:vscode-ts | product | original/line-20000 | candidate status is unsupported |
| baseline:vscode-ts | raw | original/no-trailing-newline | candidate status is unsupported |
| baseline:vscode-ts | product | original/no-trailing-newline | candidate status is unsupported |
| baseline:vscode-ts | raw | original/fences | candidate status is unsupported |
| baseline:vscode-ts | product | original/fences | candidate status is unsupported |

Markdown identities stay at the manifest’s tree-sitter-md 0.1.1 (ff455a7d). Platform has since moved to 0.1.2. The manifest configures a native MarkdownDocument extension and no highlights.scm or markdown_inline parser. Both grammar and resolver Wasm are vendored byte-exact with their upstream notices; ordinary-capture Markdown is explicitly unsupported.

Regenerate with `npm run report:baselines`. No candidate result is ever passed to golden:update.

Intentional report staleness probe for CI.
